/**
 * Lead Finder Cron Endpoint
 * 
 * GET /api/cron/lead-finder - Daily lead finder run
 * 
 * Triggered by Vercel cron at 6:30am CT (12:30 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Import orchestrator dynamically to avoid module resolution issues
async function runLeadFinder() {
  const { LeadFinderOrchestrator } = await import('@arcvest/agents');
  const orchestrator = new LeadFinderOrchestrator();
  return orchestrator.executeRun();
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('Starting lead finder cron job...');

  try {
    // Check if Google Custom Search is configured
    if (!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || !process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
      console.warn('Google Custom Search not configured, skipping lead finder run');
      return NextResponse.json({
        success: false,
        error: 'Google Custom Search not configured',
        message: 'Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID',
      });
    }

    const result = await runLeadFinder();

    console.log('Lead finder cron completed:', {
      runId: result.runId,
      status: result.status,
      leadsFound: result.leads.length,
    });

    return NextResponse.json({
      success: result.status === 'success',
      runId: result.runId,
      stats: result.stats,
      leadsFound: result.leads.length,
      errorMessage: result.errorMessage,
    });
  } catch (error) {
    console.error('Lead finder cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
