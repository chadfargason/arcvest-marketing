/**
 * Test Endpoint: Trigger specific source adapter
 *
 * POST /api/test/source/[source]
 *
 * Tests a specific source adapter by fetching and saving ideas.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSourceRegistry,
  initializeAdapters,
} from '@arcvest/services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  try {
    // Initialize adapters if not already done
    initializeAdapters();

    const registry = getSourceRegistry();

    // Map URL-friendly names to source IDs
    const sourceIdMap: Record<string, string> = {
      'bloomberg': 'email-bloomberg',
      'abnormal-returns': 'email-abnormal-returns',
      'larry-swedroe': 'email-larry-swedroe',
      'michael-green': 'email-michael-green',
      'general-inbox': 'email-general',
      'rss': 'rss-news',
    };

    const sourceId = sourceIdMap[source] || source;

    // Check if adapter exists
    const adapter = registry.get(sourceId);
    if (!adapter) {
      return NextResponse.json({
        success: false,
        error: `Unknown source: ${source}`,
        availableSources: Object.keys(sourceIdMap),
      }, { status: 400 });
    }

    console.log(`[Test] Fetching from source: ${sourceId}`);

    // Fetch from the source
    const result = await registry.fetchSource(sourceId);

    return NextResponse.json({
      success: result.success,
      sourceId,
      sourceName: adapter.sourceName,
      ideasFound: result.ideas.length,
      duration: result.duration,
      error: result.error,
      ideas: result.ideas.map(idea => ({
        title: idea.title,
        summary: idea.summary?.substring(0, 200),
        originalUrl: idea.originalUrl,
        tags: idea.tags,
        discoveredAt: idea.discoveredAt,
      })),
    });
  } catch (error) {
    console.error(`[Test] Error fetching from ${source}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  // For convenience, allow GET as well
  return POST(request, { params });
}
