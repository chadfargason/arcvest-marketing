/**
 * Bloomberg Email Scan API
 *
 * GET: Run a manual scan of Gmail for Bloomberg content
 * POST: Run scan with options (auto-queue, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { BloombergProcessor } from '@/lib/bloomberg';

/**
 * GET /api/bloomberg/scan
 * Run a quick scan for Bloomberg emails with article extraction
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hoursBack') || '24');
    const extract = searchParams.get('extract') !== 'false'; // Default true

    console.log('[Bloomberg Scan] Starting with hoursBack:', hoursBack, 'extract:', extract);

    const processor = new BloombergProcessor();

    if (extract) {
      // Full scan with article extraction and scoring
      const result = await processor.scan({
        hoursBack,
        minScore: 50, // Lower threshold for manual scans to see more results
        maxArticles: 10,
        autoQueue: false, // Don't auto-queue on manual scan
        includeTrash: true,
      });

      return NextResponse.json(result);
    } else {
      // Quick scan - just list emails without extraction
      const result = await processor.scan({
        hoursBack,
        minScore: 0,
        maxArticles: 0, // This will skip extraction
        autoQueue: false,
        includeTrash: true,
      });

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('[Bloomberg API] Scan failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Bloomberg scan failed',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bloomberg/scan
 * Run scan with custom options and optionally queue to pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      hoursBack = 24,
      minScore = 60,
      maxArticles = 5,
      autoQueue = false,
    } = body;

    console.log('[Bloomberg Scan POST] Starting with options:', { hoursBack, minScore, maxArticles, autoQueue });

    const processor = new BloombergProcessor();
    const result = await processor.scan({
      hoursBack,
      minScore,
      maxArticles,
      autoQueue,
      includeTrash: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Bloomberg API] Scan failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Bloomberg scan failed',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
