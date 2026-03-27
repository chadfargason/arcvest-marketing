import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type, dailyBudget } = body as {
      id: string;
      type: 'campaign' | 'adset';
      dailyBudget: number;
    };

    if (!id || !type || dailyBudget === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: id, type, dailyBudget' },
        { status: 400 },
      );
    }

    if (dailyBudget < 1) {
      return NextResponse.json(
        { error: 'Daily budget must be at least $1.00' },
        { status: 400 },
      );
    }

    const service = getMetaAdsService();
    service.initializeFromEnv();

    if (type === 'campaign') {
      await service.updateCampaignBudget(id, dailyBudget);
    } else {
      await service.updateAdSetBudget(id, dailyBudget);
    }

    return NextResponse.json({ success: true, id, type, dailyBudget });
  } catch (error) {
    console.error('Budget update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update budget' },
      { status: 500 },
    );
  }
}
