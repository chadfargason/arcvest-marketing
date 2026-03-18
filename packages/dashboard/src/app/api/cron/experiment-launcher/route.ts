/**
 * Experiment Launcher Cron
 *
 * Runs weekly (Monday 7am CT / 13:00 UTC).
 * Identifies untested persona/voice combos, prioritizes based on
 * performance of related combos, and launches 1-2 new experiments per week.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const MAX_DAILY_EXPERIMENT_BUDGET = 50; // $50/day max across all experiments
const EXPERIMENT_BUDGET_PER_DAY = 10; // $10/day per new experiment
const MAX_EXPERIMENTS_PER_WEEK = 2;

// All 8 persona IDs and 5 voice IDs (8x5 = 40 combos)
const ALL_PERSONA_IDS = [
  'pre-retiree', 'hnw-fee-conscious', 'new-retiree', 'business-owner',
  'sudden-wealth', 'diy-investor', 'widow-divorcee', 'healthcare-worker',
];
const ALL_VOICE_IDS = [
  'authoritative-calm', 'empathetic-advisor', 'data-driven', 'conversational', 'urgent-action',
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Experiment Launcher] Starting weekly experiment launch...');

  const summary = { launched: 0, skipped: 0, errors: [] as string[] };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const googleAds = getGoogleAdsClient();

    // 1. Check current experiment budget
    const { data: activeExperiments } = await supabase
      .from('experiments')
      .select('daily_budget')
      .in('status', ['live', 'optimizing']);

    const currentDailySpend = (activeExperiments || []).reduce(
      (sum, e) => sum + (e.daily_budget || 0), 0
    );

    const budgetAvailable = MAX_DAILY_EXPERIMENT_BUDGET - currentDailySpend;
    if (budgetAvailable < EXPERIMENT_BUDGET_PER_DAY) {
      console.log(`[Experiment Launcher] Budget exhausted ($${currentDailySpend}/$${MAX_DAILY_EXPERIMENT_BUDGET} daily)`);
      return NextResponse.json({ success: true, message: 'Budget exhausted', ...summary });
    }

    // 2. Find tested combos
    const { data: testedCombos } = await supabase
      .from('experiments')
      .select('persona_id, voice_id')
      .not('status', 'eq', 'draft');

    const testedSet = new Set(
      (testedCombos || []).map(c => `${c.persona_id}:${c.voice_id}`)
    );

    // 3. Find untested combos
    const untestedCombos: Array<{ personaId: string; voiceId: string }> = [];
    for (const p of ALL_PERSONA_IDS) {
      for (const v of ALL_VOICE_IDS) {
        if (!testedSet.has(`${p}:${v}`)) {
          untestedCombos.push({ personaId: p, voiceId: v });
        }
      }
    }

    if (untestedCombos.length === 0) {
      console.log('[Experiment Launcher] All 40 combos have been tested');
      return NextResponse.json({ success: true, message: 'All combos tested', ...summary });
    }

    // 4. Prioritize by performance of related combos
    const { data: pvPerf } = await supabase
      .from('persona_voice_performance')
      .select('persona_id, voice_id, ctr')
      .order('week_start', { ascending: false })
      .limit(100);

    const personaScores = new Map<string, number>();
    const voiceScores = new Map<string, number>();

    for (const row of pvPerf || []) {
      const pScore = personaScores.get(row.persona_id) || 0;
      personaScores.set(row.persona_id, Math.max(pScore, row.ctr));
      const vScore = voiceScores.get(row.voice_id) || 0;
      voiceScores.set(row.voice_id, Math.max(vScore, row.ctr));
    }

    // Score untested combos: prefer combos where persona OR voice has shown strength
    const scoredCombos = untestedCombos.map(c => ({
      ...c,
      score: (personaScores.get(c.personaId) || 0) + (voiceScores.get(c.voiceId) || 0),
    })).sort((a, b) => b.score - a.score);

    // 5. Launch top 1-2 experiments
    const maxToLaunch = Math.min(
      MAX_EXPERIMENTS_PER_WEEK,
      Math.floor(budgetAvailable / EXPERIMENT_BUDGET_PER_DAY),
      scoredCombos.length
    );

    for (let i = 0; i < maxToLaunch; i++) {
      const combo = scoredCombos[i];

      try {
        // Import RSA pipeline dynamically
        const { getRSAPipeline, getPersonaById } = await import('@arcvest/agents');
        const { getAdPerformanceLearner } = await import('@arcvest/services');

        const persona = getPersonaById(combo.personaId);
        if (!persona) {
          summary.errors.push(`Unknown persona: ${combo.personaId}`);
          continue;
        }

        // Generate RSAs with performance context
        const learner = getAdPerformanceLearner();
        const perfContext = await learner.buildContext(combo.personaId, combo.voiceId);

        const pipeline = getRSAPipeline();
        const rsaResult = await pipeline.generate(combo.personaId, combo.voiceId, 3, perfContext);

        // Create experiment in DB
        const { data: experiment, error: expError } = await supabase
          .from('experiments')
          .insert({
            name: `Auto: ${combo.personaId} + ${combo.voiceId}`,
            description: `Auto-launched experiment for ${combo.personaId} persona with ${combo.voiceId} voice`,
            status: 'generating',
            daily_budget: EXPERIMENT_BUDGET_PER_DAY,
            bid_strategy: 'maximize_clicks',
            keywords: persona.keywordThemes.map((k: string) => k),
            match_type: 'broad',
            landing_page_url: 'https://arcvest.com/start',
            target_locations: ['2840'], // US
            persona_id: combo.personaId,
            voice_id: combo.voiceId,
            num_variations: rsaResult.variations.length + 1,
            auto_optimize: true,
          })
          .select('id')
          .single();

        if (expError || !experiment) {
          summary.errors.push(`DB insert failed for ${combo.personaId}+${combo.voiceId}: ${expError?.message}`);
          continue;
        }

        // Create Google Ads campaign
        const budgetMicros = EXPERIMENT_BUDGET_PER_DAY * 1_000_000;
        const budgetResource = await googleAds.createCampaignBudget(budgetMicros);
        const campaignResource = await googleAds.createCampaign(
          `Exp: ${combo.personaId}-${combo.voiceId}`,
          budgetResource,
          'maximize_clicks',
          undefined,
          'PAUSED'
        );

        // Set US targeting
        await googleAds.setCampaignLocationTargeting(campaignResource, ['2840']);

        const campaignId = campaignResource.split('/').pop()!;

        // Create ad groups for master + variations
        const allAds = [rsaResult.master, ...rsaResult.variations];
        for (let v = 0; v < allAds.length; v++) {
          const ad = allAds[v];
          const agResource = await googleAds.createAdGroup(campaignResource, `V${v + 1}`);
          const agId = agResource.split('/').pop()!;

          // Add keywords
          await googleAds.addKeywords(
            agResource,
            persona.keywordThemes.slice(0, 10),
            'BROAD'
          );

          // Create RSA
          await googleAds.createResponsiveSearchAd(
            agResource,
            ad.headlines.map((h: { text: string; pinPosition?: number }) => ({ text: h.text, pinPosition: h.pinPosition })),
            ad.descriptions.map((d: { text: string; pinPosition?: number }) => ({ text: d.text, pinPosition: d.pinPosition })),
            'https://arcvest.com/start'
          );

          // Store variation
          await supabase.from('experiment_variations').insert({
            experiment_id: experiment.id,
            variation_number: v + 1,
            headlines: ad.headlines,
            descriptions: ad.descriptions,
            status: 'active',
            google_ad_group_id: agId,
          });
        }

        // Enable campaign
        await googleAds.enableCampaign(campaignResource);

        // Update experiment status
        await supabase
          .from('experiments')
          .update({
            status: 'live',
            google_campaign_id: campaignId,
            google_budget_id: budgetResource.split('/').pop(),
          })
          .eq('id', experiment.id);

        await supabase.from('experiment_logs').insert({
          experiment_id: experiment.id,
          action: 'auto_launched',
          details: {
            persona_id: combo.personaId,
            voice_id: combo.voiceId,
            priority_score: combo.score,
            variations: allAds.length,
            daily_budget: EXPERIMENT_BUDGET_PER_DAY,
          },
        });

        summary.launched++;
        console.log(`[Experiment Launcher] Launched: ${combo.personaId}+${combo.voiceId} (score: ${combo.score.toFixed(1)})`);
      } catch (launchErr) {
        const msg = launchErr instanceof Error ? launchErr.message : 'Unknown error';
        console.error(`[Experiment Launcher] Failed to launch ${combo.personaId}+${combo.voiceId}:`, msg);
        summary.errors.push(`${combo.personaId}+${combo.voiceId}: ${msg}`);
      }
    }

    // Log
    await supabase.from('pipeline_logs').insert({
      pipeline_name: 'experiment_launcher',
      status: summary.errors.length === 0 ? 'success' : 'partial',
      details: {
        ...summary,
        untested_remaining: untestedCombos.length - summary.launched,
        budget_available: budgetAvailable,
      },
      created_at: new Date().toISOString(),
    });

    console.log('[Experiment Launcher] Complete:', summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error('[Experiment Launcher] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Experiment launcher failed',
      },
      { status: 500 }
    );
  }
}
