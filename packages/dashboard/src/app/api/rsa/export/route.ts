/**
 * RSA Export API
 * POST - Generate Google Ads CSV export
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

interface RSAHeadline {
  text: string;
  type?: string;
  pinPosition?: number;
}

interface RSADescription {
  text: string;
  pinPosition?: number;
}

interface ExportRequest {
  assetIds: string[];
  format: 'google_ads_csv' | 'json';
  campaignName?: string;
  adGroupName?: string;
  finalUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { assetIds, format, campaignName, adGroupName, finalUrl } = body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: 'assetIds required' }, { status: 400 });
    }

    if (!format || !['google_ads_csv', 'json'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch assets
    const { data: assets, error } = await supabase
      .from('creative_assets')
      .select('*')
      .in('id', assetIds)
      .eq('asset_type', 'ad_copy')
      .is('deleted_at', null);

    if (error) {
      console.error('[RSA Export] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!assets || assets.length === 0) {
      return NextResponse.json({ error: 'No assets found' }, { status: 404 });
    }

    // Mark assets as exported
    await supabase
      .from('creative_assets')
      .update({ exported_at: new Date().toISOString() })
      .in('id', assetIds);

    // Record export history
    await supabase.from('rsa_export_history').insert({
      asset_ids: assetIds,
      asset_count: assets.length,
      export_type: format,
      campaign_name: campaignName || null,
      ad_group_name: adGroupName || null,
      final_url: finalUrl || null,
    });

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: assets.map(a => ({
          id: a.id,
          name: a.name,
          headlines: a.content?.headlines || [],
          descriptions: a.content?.descriptions || [],
          persona_id: a.persona_id,
          voice_id: a.voice_id,
        })),
      });
    }

    // Generate Google Ads CSV
    const csv = generateGoogleAdsCSV(assets, {
      campaignName: campaignName || 'ArcVest Campaign',
      adGroupName: adGroupName || 'RSA Ad Group',
      finalUrl: finalUrl || 'https://arcvest.com',
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="rsa-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('[RSA Export] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

interface CSVOptions {
  campaignName: string;
  adGroupName: string;
  finalUrl: string;
}

function generateGoogleAdsCSV(
  assets: Array<{
    id: string;
    name: string;
    content?: { headlines?: RSAHeadline[]; descriptions?: RSADescription[] };
  }>,
  options: CSVOptions
): string {
  const { campaignName, adGroupName, finalUrl } = options;

  // Google Ads bulk upload format for RSAs
  // Reference: https://support.google.com/google-ads/answer/7684791
  const headers = [
    'Campaign',
    'Ad group',
    'Final URL',
    'Headline 1',
    'Headline 2',
    'Headline 3',
    'Headline 4',
    'Headline 5',
    'Headline 6',
    'Headline 7',
    'Headline 8',
    'Headline 9',
    'Headline 10',
    'Headline 11',
    'Headline 12',
    'Headline 13',
    'Headline 14',
    'Headline 15',
    'Description 1',
    'Description 2',
    'Description 3',
    'Description 4',
    'Headline 1 position',
    'Headline 2 position',
    'Headline 3 position',
    'Description 1 position',
    'Description 2 position',
  ];

  const rows: string[][] = [];

  for (const asset of assets) {
    const headlines = asset.content?.headlines || [];
    const descriptions = asset.content?.descriptions || [];

    const row: string[] = [
      campaignName,
      adGroupName,
      finalUrl,
    ];

    // Add 15 headline slots
    for (let i = 0; i < 15; i++) {
      row.push(headlines[i]?.text || '');
    }

    // Add 4 description slots
    for (let i = 0; i < 4; i++) {
      row.push(descriptions[i]?.text || '');
    }

    // Add pin positions (empty if not pinned)
    // Headline positions
    row.push(headlines[0]?.pinPosition?.toString() || '');
    row.push(headlines[1]?.pinPosition?.toString() || '');
    row.push(headlines[2]?.pinPosition?.toString() || '');
    // Description positions
    row.push(descriptions[0]?.pinPosition?.toString() || '');
    row.push(descriptions[1]?.pinPosition?.toString() || '');

    rows.push(row);
  }

  // Convert to CSV
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ];

  return csvLines.join('\n');
}
