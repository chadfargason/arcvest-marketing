/**
 * Experiment Auto-Optimization Cron
 *
 * Runs every 6 hours via Vercel Cron.
 * Syncs metrics from Google Ads, evaluates variation performance,
 * pauses losers, and declares winners.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface ExperimentRow {
  id: string;
  google_campaign_id: string;
  optimization_metric: string;
  created_at: string;
}

interface VariationRow {
  id: string;
  experiment_id: string;
  variation_number: number;
  status: string;
  google_ad_group_id: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron sends x-vercel-cron: 1)
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('[Experiment Optimizer] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Experiment Optimizer] Starting (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})...`);

  const summary = { processed: 0, synced: 0, variationsPaused: 0, experimentsCompleted: 0 };

  try {
    const supabase = await createServiceClient();
    const googleAds = getGoogleAdsClient();
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');

    // Query live experiments with auto_optimize enabled
    const { data: experiments, error: expError } = await supabase
      .from('experiments')
      .select('id, google_campaign_id, optimization_metric, created_at')
      .eq('status', 'live')
      .eq('auto_optimize', true);

    if (expError) throw new Error(`Failed to query experiments: ${expError.message}`);
    if (!experiments || experiments.length === 0) {
      console.log('[Experiment Optimizer] No live auto-optimize experiments found');
      return NextResponse.json({ success: true, ...summary });
    }

    for (const exp of experiments as ExperimentRow[]) {
      summary.processed++;

      try {
        // a) Sync metrics
        const today = new Date().toISOString().split('T')[0];
        const startDate = exp.created_at.split('T')[0];
        const adGroupMetrics = await googleAds.getAdGroupMetrics(exp.google_campaign_id, startDate, today);

        // Get all variations for this experiment
        const { data: variations } = await supabase
          .from('experiment_variations')
          .select('*')
          .eq('experiment_id', exp.id);

        if (!variations || variations.length === 0) continue;

        // Update each variation with synced metrics
        for (const v of variations as VariationRow[]) {
          if (!v.google_ad_group_id) continue;
          const metrics = adGroupMetrics.find((m) => m.adGroupId === v.google_ad_group_id);
          if (metrics) {
            await supabase
              .from('experiment_variations')
              .update({
                impressions: metrics.impressions,
                clicks: metrics.clicks,
                cost: metrics.cost,
                conversions: metrics.conversions,
                ctr: metrics.ctr,
                cpc: metrics.cpc,
              })
              .eq('id', v.id);
          }
        }

        summary.synced++;

        await supabase.from('experiment_logs').insert({
          experiment_id: exp.id,
          action: 'optimizer_synced',
          details: { ad_groups_synced: adGroupMetrics.length },
        });

        // b) Evaluate — re-fetch updated variations
        const { data: updatedVariations } = await supabase
          .from('experiment_variations')
          .select('*')
          .eq('experiment_id', exp.id);

        if (!updatedVariations) continue;

        const activeVariations = (updatedVariations as VariationRow[]).filter(
          (v) => v.status === 'active'
        );

        // Skip if insufficient data
        const experimentAgeDays = Math.floor(
          (Date.now() - new Date(exp.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        const hasEnoughData = activeVariations.every(
          (v) => v.impressions >= 200 && v.clicks >= 50
        ) && experimentAgeDays >= 5;

        if (!hasEnoughData) {
          console.log(`[Experiment Optimizer] Skipping ${exp.id} — insufficient data`);
          continue;
        }

        // Rank by optimization metric and find best
        const metric = exp.optimization_metric;
        const isLowerBetter = metric === 'cpc';

        const getMetricValue = (v: VariationRow): number => {
          switch (metric) {
            case 'ctr': return v.ctr;
            case 'conversions': return v.conversions;
            case 'cpc': return v.cpc;
            case 'impressions': return v.impressions;
            default: return v.ctr;
          }
        };

        const best = isLowerBetter
          ? activeVariations.reduce((a, b) => (getMetricValue(a) < getMetricValue(b) ? a : b))
          : activeVariations.reduce((a, b) => (getMetricValue(a) > getMetricValue(b) ? a : b));

        const bestValue = getMetricValue(best);

        // Compare each variation to the best
        for (const v of activeVariations) {
          if (v.id === best.id) continue;

          const vValue = getMetricValue(v);
          let percentWorse: number;

          if (isLowerBetter) {
            // For CPC: higher is worse
            percentWorse = bestValue > 0 ? ((vValue - bestValue) / bestValue) * 100 : 0;
          } else {
            // For CTR/conversions/impressions: lower is worse
            percentWorse = bestValue > 0 ? ((bestValue - vValue) / bestValue) * 100 : 0;
          }

          if (percentWorse > 65) {
            // Pause this variation
            const adGroupResource = `customers/${customerId}/adGroups/${v.google_ad_group_id}`;
            await googleAds.pauseAdGroup(adGroupResource);

            await supabase
              .from('experiment_variations')
              .update({ status: 'loser' })
              .eq('id', v.id);

            const metricLabel = metric.toUpperCase();
            const vDisplay = metric === 'cpc' ? `$${vValue.toFixed(2)}` : metric === 'ctr' ? `${vValue.toFixed(1)}%` : String(vValue);
            const bestDisplay = metric === 'cpc' ? `$${bestValue.toFixed(2)}` : metric === 'ctr' ? `${bestValue.toFixed(1)}%` : String(bestValue);

            await supabase.from('experiment_logs').insert({
              experiment_id: exp.id,
              action: 'optimizer_paused_variation',
              details: {
                variation_id: v.id,
                variation_number: v.variation_number,
                metric: metricLabel,
                value: vDisplay,
                best_value: bestDisplay,
                percent_worse: Math.round(percentWorse),
                explanation: `Paused Variation ${v.variation_number} — ${metricLabel} ${vDisplay} vs best ${bestDisplay} (${Math.round(percentWorse)}% worse)`,
              },
            });

            summary.variationsPaused++;
          }
        }

        // Check if only 1 active variation remains → declare winner
        const { data: remainingActive } = await supabase
          .from('experiment_variations')
          .select('id, variation_number')
          .eq('experiment_id', exp.id)
          .eq('status', 'active');

        if (remainingActive && remainingActive.length === 1) {
          const winner = remainingActive[0];

          await supabase
            .from('experiment_variations')
            .update({ status: 'winner' })
            .eq('id', winner.id);

          await supabase
            .from('experiments')
            .update({ status: 'completed', winner_variation_id: winner.id })
            .eq('id', exp.id);

          // Pause the campaign
          const campaignResource = `customers/${customerId}/campaigns/${exp.google_campaign_id}`;
          await googleAds.pauseCampaign(campaignResource);

          await supabase.from('experiment_logs').insert({
            experiment_id: exp.id,
            action: 'optimizer_declared_winner',
            details: {
              winner_variation_id: winner.id,
              winner_variation_number: winner.variation_number,
              explanation: `Variation ${winner.variation_number} declared winner — last active variation standing`,
            },
          });

          summary.experimentsCompleted++;
        }
      } catch (expErr) {
        console.error(`[Experiment Optimizer] Error processing experiment ${exp.id}:`, expErr);
      }
    }

    console.log('[Experiment Optimizer] Complete:', summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error('[Experiment Optimizer] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Experiment optimizer cron failed',
      },
      { status: 500 }
    );
  }
}
