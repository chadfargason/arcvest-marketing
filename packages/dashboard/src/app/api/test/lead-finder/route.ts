/**
 * Lead Finder Test Endpoint
 * 
 * GET /api/test/lead-finder - Manual trigger for testing
 * 
 * Allows testing the lead finder pipeline without waiting for cron.
 */

import { NextRequest, NextResponse } from 'next/server';

// Import orchestrator dynamically
async function runLeadFinder() {
  const { LeadFinderOrchestrator } = await import('@arcvest/agents');
  const orchestrator = new LeadFinderOrchestrator();
  return orchestrator.executeRun();
}

async function getTodayConfig() {
  const { LeadFinderOrchestrator } = await import('@arcvest/agents');
  const orchestrator = new LeadFinderOrchestrator();
  return orchestrator.determineTodayRotation();
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'status';

  console.log(`Lead finder test endpoint called with action: ${action}`);

  try {
    switch (action) {
      case 'status': {
        // Check configuration status
        const hasSearchKey = Boolean(process.env.GOOGLE_CUSTOM_SEARCH_API_KEY);
        const hasSearchEngineId = Boolean(process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID);
        const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

        return NextResponse.json({
          configured: hasSearchKey && hasSearchEngineId && hasAnthropicKey,
          googleSearch: {
            apiKey: hasSearchKey ? 'configured' : 'missing',
            searchEngineId: hasSearchEngineId ? 'configured' : 'missing',
          },
          anthropic: hasAnthropicKey ? 'configured' : 'missing',
        });
      }

      case 'config': {
        // Get today's rotation configuration
        const config = await getTodayConfig();
        return NextResponse.json({ config });
      }

      case 'run': {
        // Check if configured
        if (!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || !process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
          return NextResponse.json({
            error: 'Google Custom Search not configured',
            setup: {
              step1: 'Create Programmable Search Engine at https://programmablesearchengine.google.com/',
              step2: 'Enable "Search the entire web"',
              step3: 'Get Search Engine ID (cx parameter)',
              step4: 'Enable Custom Search API in Google Cloud Console',
              step5: 'Create API key',
              step6: 'Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID env vars',
            },
          }, { status: 400 });
        }

        // Execute full run
        const result = await runLeadFinder();

        return NextResponse.json({
          success: result.status === 'success',
          runId: result.runId,
          stats: result.stats,
          leadsFound: result.leads.length,
          sampleLeads: result.leads.slice(0, 3).map((l: { fullName: string; title: string | null; company: string | null; score: number }) => ({
            name: l.fullName,
            title: l.title,
            company: l.company,
            score: l.score,
            tier: l.tier,
          })),
          errorMessage: result.errorMessage,
        });
      }

      default:
        return NextResponse.json({
          error: 'Unknown action',
          availableActions: ['status', 'config', 'run'],
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Lead finder test error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
