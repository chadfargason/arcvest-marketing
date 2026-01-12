/**
 * Bloomberg Email Scan API
 *
 * GET: Run a manual scan of Gmail for Bloomberg content
 * POST: Run scan with options (auto-queue, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBloombergProcessor } from '@/lib/bloomberg';

/**
 * GET /api/bloomberg/scan
 * Run a quick scan for Bloomberg emails
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hoursBack') || '24');

    const processor = getBloombergProcessor();
    const result = await processor.scan({
      hoursBack,
      minScore: 60,
      maxArticles: 5,
      autoQueue: false, // Don't auto-queue on manual scan
      includeTrash: true, // Include trashed emails
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Bloomberg API] Scan failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Bloomberg scan failed',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bloomberg/scan
 * Run scan with custom options
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

    const processor = getBloombergProcessor();
    const result = await processor.scan({
      hoursBack,
      minScore,
      maxArticles,
      autoQueue,
      includeTrash: true, // Include trashed emails
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Bloomberg API] Scan failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Bloomberg scan failed',
      },
      { status: 500 }
    );
  }
}
