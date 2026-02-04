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
        const hasSerperKey = Boolean(process.env.SERPER_API_KEY);
        const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

        return NextResponse.json({
          configured: hasSerperKey && hasAnthropicKey,
          serperApi: hasSerperKey ? 'configured' : 'missing',
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
        if (!process.env.SERPER_API_KEY) {
          return NextResponse.json({
            error: 'Serper API not configured',
            setup: {
              step1: 'Sign up at https://serper.dev/',
              step2: 'Get your API key from the dashboard',
              step3: 'Set SERPER_API_KEY environment variable in Vercel',
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
          sampleLeads: result.leads.slice(0, 3).map((l: { fullName: string; title: string | null; company: string | null; score: number; tier: string }) => ({
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
