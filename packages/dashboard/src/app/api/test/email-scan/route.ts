/**
 * Test Endpoint: Trigger all email source adapters
 *
 * POST /api/test/email-scan
 *
 * Tests all email adapters by fetching and saving ideas.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSourceRegistry,
  initializeAdapters,
} from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Initialize adapters if not already done
    initializeAdapters();

    const registry = getSourceRegistry();

    console.log('[Test] Running email scan on all email sources');

    // Fetch from all email sources
    const results = await registry.fetchEmailSources();

    // Build summary
    const summary: Record<string, {
      success: boolean;
      ideasFound: number;
      duration: number;
      error?: string;
    }> = {};

    let totalIdeas = 0;
    let totalErrors = 0;

    for (const [sourceId, result] of results) {
      summary[sourceId] = {
        success: result.success,
        ideasFound: result.ideas.length,
        duration: result.duration,
        error: result.error,
      };
      totalIdeas += result.ideas.length;
      if (!result.success) totalErrors++;
    }

    return NextResponse.json({
      success: totalErrors === 0,
      sourcesScanned: results.size,
      totalIdeasFound: totalIdeas,
      totalErrors,
      results: summary,
    });
  } catch (error) {
    console.error('[Test] Error in email scan:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
