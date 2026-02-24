import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getRSAPipeline } from '@arcvest/agents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

// POST /api/experiments/[id]/generate - Generate ad copy variations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // Fetch experiment
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    if (!['draft', 'ready'].includes(experiment.status)) {
      return NextResponse.json(
        { error: 'Can only generate for draft or ready experiments' },
        { status: 400 }
      );
    }

    if (!experiment.persona_id || !experiment.voice_id) {
      return NextResponse.json(
        { error: 'Persona and voice must be set before generating' },
        { status: 400 }
      );
    }

    // Update status to generating
    await supabase
      .from('experiments')
      .update({ status: 'generating' })
      .eq('id', id);

    // Delete any existing variations
    await supabase
      .from('experiment_variations')
      .delete()
      .eq('experiment_id', id);

    try {
      // Generate using RSA pipeline
      const pipeline = getRSAPipeline();
      const result = await pipeline.generate(
        experiment.persona_id,
        experiment.voice_id,
        experiment.num_variations || 5
      );

      // Save master as variation 1
      const allVariations = [result.master, ...result.variations];
      const variationsToInsert = allVariations
        .slice(0, experiment.num_variations || 5)
        .map((asset, index) => ({
          experiment_id: id,
          variation_number: index + 1,
          headlines: asset.headlines,
          descriptions: asset.descriptions,
          status: 'draft',
        }));

      const { error: insertError } = await supabase
        .from('experiment_variations')
        .insert(variationsToInsert);

      if (insertError) {
        throw new Error(`Failed to save variations: ${insertError.message}`);
      }

      // Update experiment status to ready
      await supabase
        .from('experiments')
        .update({ status: 'ready' })
        .eq('id', id);

      // Log generation
      await supabase.from('experiment_logs').insert({
        experiment_id: id,
        action: 'generated',
        details: {
          variationCount: variationsToInsert.length,
          personaId: experiment.persona_id,
          voiceId: experiment.voice_id,
          processingTimeMs: result.metadata.processingTimeMs,
          tokensUsed: result.metadata.totalTokensUsed,
          compliancePassed: result.complianceResult.passed,
        },
      });

      // Fetch the saved variations
      const { data: savedVariations } = await supabase
        .from('experiment_variations')
        .select('*')
        .eq('experiment_id', id)
        .order('variation_number', { ascending: true });

      return NextResponse.json({
        data: {
          variations: savedVariations || [],
          metadata: result.metadata,
          complianceResult: result.complianceResult,
        },
      });
    } catch (genError) {
      // Reset status on failure
      await supabase
        .from('experiments')
        .update({ status: 'draft' })
        .eq('id', id);

      throw genError;
    }
  } catch (error) {
    console.error('[Experiments API] Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate variations' },
      { status: 500 }
    );
  }
}
