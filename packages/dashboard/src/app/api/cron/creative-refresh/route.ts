/**
 * Creative Refresh Cron
 *
 * Runs weekly (Sunday 8am CT / 14:00 UTC).
 * Generates new RSA variations informed by real performance data.
 * New ads are created with status 'pending_review' — human approves before going live.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes — RSA generation is multi-step

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Creative Refresh] Starting weekly creative refresh...');

  const summary = { personaVoiceCombos: 0, rsasGenerated: 0, errors: [] as string[] };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Import dynamically to avoid build issues with monorepo deps
    const { getRSAPipeline } = await import('@arcvest/agents');
    const { getAdPerformanceLearner } = await import('@arcvest/services');

    const pipeline = getRSAPipeline();
    const learner = getAdPerformanceLearner();

    // Get active persona/voice combos from rsa_asset_groups
    const { data: activeGroups } = await supabase
      .from('rsa_asset_groups')
      .select('persona_id, voice_id')
      .in('status', ['active', 'approved']);

    if (!activeGroups || activeGroups.length === 0) {
      console.log('[Creative Refresh] No active persona/voice combos found');
      return NextResponse.json({ success: true, message: 'No active combos to refresh', ...summary });
    }

    // Deduplicate combos
    const combos = Array.from(
      new Set(activeGroups.map(g => `${g.persona_id}:${g.voice_id}`))
    ).map(c => {
      const [personaId, voiceId] = c.split(':');
      return { personaId, voiceId };
    });

    for (const combo of combos) {
      try {
        summary.personaVoiceCombos++;

        // Build performance context specific to this combo
        const perfContext = await learner.buildContext(combo.personaId, combo.voiceId);

        // Generate 3 new RSA variations with performance context
        const result = await pipeline.generate(
          combo.personaId,
          combo.voiceId,
          3, // 3 variations per refresh
          perfContext
        );

        // Store as pending_review
        const { error: groupError } = await supabase.from('rsa_asset_groups').insert({
          name: `Refresh ${combo.personaId}+${combo.voiceId} ${new Date().toISOString().split('T')[0]}`,
          persona_id: combo.personaId,
          voice_id: combo.voiceId,
          status: 'pending_review',
          total_variations: result.variations.length,
          generation_config: {
            source: 'creative_refresh_cron',
            performanceContextUsed: true,
            generatedAt: new Date().toISOString(),
            tokensUsed: result.metadata.totalTokensUsed,
          },
          last_generated_at: new Date().toISOString(),
        });

        if (groupError) {
          console.error(`[Creative Refresh] Failed to store group for ${combo.personaId}+${combo.voiceId}:`, groupError);
          summary.errors.push(`${combo.personaId}+${combo.voiceId}: ${groupError.message}`);
          continue;
        }

        summary.rsasGenerated += 1 + result.variations.length; // master + variations

        console.log(`[Creative Refresh] Generated ${1 + result.variations.length} RSAs for ${combo.personaId}+${combo.voiceId}`);
      } catch (comboErr) {
        const msg = comboErr instanceof Error ? comboErr.message : 'Unknown error';
        console.error(`[Creative Refresh] Error for ${combo.personaId}+${combo.voiceId}:`, msg);
        summary.errors.push(`${combo.personaId}+${combo.voiceId}: ${msg}`);
      }
    }

    // Log to pipeline_logs
    await supabase.from('pipeline_logs').insert({
      pipeline_name: 'creative_refresh',
      status: summary.errors.length === 0 ? 'success' : 'partial',
      details: summary,
      created_at: new Date().toISOString(),
    });

    console.log('[Creative Refresh] Complete:', summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error('[Creative Refresh] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Creative refresh failed',
      },
      { status: 500 }
    );
  }
}
