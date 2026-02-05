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
export const maxDuration = 300; // 5 minutes for lead generation

export async function GET(request: NextRequest) {
  // Verify this is from Vercel cron OR has valid authorization
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow if it's from Vercel cron OR has valid authorization header
  const isAuthorized = isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isAuthorized) {
    console.error('Unauthorized cron attempt:', {
      isVercelCron,
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('Starting lead finder cron job...', { triggeredBy: isVercelCron ? 'Vercel Cron' : 'Manual' });

  try {
    // Check if Serper API is configured
    if (!process.env.SERPER_API_KEY) {
      console.warn('Serper API not configured, skipping lead finder run');
      return NextResponse.json({
        success: false,
        error: 'Serper API not configured',
        message: 'Set SERPER_API_KEY environment variable',
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
