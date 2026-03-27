import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type, status } = body as {
      id: string;
      type: 'campaign' | 'adset';
      status: 'ACTIVE' | 'PAUSED';
    };

    if (!id || !type || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id, type, status' },
        { status: 400 },
      );
    }

    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be ACTIVE or PAUSED' },
        { status: 400 },
      );
    }

    const service = getMetaAdsService();
    service.initializeFromEnv();

    if (type === 'campaign') {
      await service.updateCampaignStatus(id, status);
    } else {
      await service.updateAdSetStatus(id, status);
    }

    return NextResponse.json({ success: true, id, type, status });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 },
    );
  }
}
