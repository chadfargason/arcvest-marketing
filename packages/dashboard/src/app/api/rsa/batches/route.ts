/**
 * RSA Batches API
 * GET - List generation batches (groups assets by generation date/persona/voice)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

interface AssetGroup {
  persona_id: string | null;
  voice_id: string | null;
  created_date: string;
  master_count: number;
  variation_count: number;
  total_count: number;
  approved_count: number;
  favorited_count: number;
  assets: unknown[];
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Optional filters
    const daysBack = parseInt(searchParams.get('days') || '7');
    const personaId = searchParams.get('persona');
    const voiceId = searchParams.get('voice');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const supabase = getSupabase();

    // Calculate date range
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    // Build query for master assets (which represent generation runs)
    let query = supabase
      .from('creative_assets')
      .select('*')
      .eq('asset_type', 'ad_copy')
      .eq('variation_type', 'master')
      .is('deleted_at', null)
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (personaId) {
      query = query.eq('persona_id', personaId);
    }

    if (voiceId) {
      query = query.eq('voice_id', voiceId);
    }

    const { data: masterAssets, error } = await query;

    if (error) {
      console.error('[RSA Batches] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by date + persona + voice
    const groups = new Map<string, AssetGroup>();

    for (const asset of masterAssets || []) {
      // Create date string (YYYY-MM-DD)
      const createdDate = new Date(asset.created_at).toISOString().split('T')[0];
      const groupKey = `${createdDate}|${asset.persona_id}|${asset.voice_id}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          persona_id: asset.persona_id,
          voice_id: asset.voice_id,
          created_date: createdDate,
          master_count: 0,
          variation_count: 0,
          total_count: 0,
          approved_count: 0,
          favorited_count: 0,
          assets: [],
        });
      }

      const group = groups.get(groupKey)!;
      group.master_count++;
      group.total_count++;
      if (asset.status === 'approved' || asset.status === 'active') {
        group.approved_count++;
      }
      if (asset.is_favorite) {
        group.favorited_count++;
      }
      group.assets.push({
        id: asset.id,
        name: asset.name,
        status: asset.status,
        is_favorite: asset.is_favorite,
        rating: asset.rating,
        compliance_passed: asset.compliance_passed,
        created_at: asset.created_at,
      });
    }

    // Get variation counts for each master
    const masterIds = (masterAssets || []).map(a => a.id);
    if (masterIds.length > 0) {
      const { data: variations } = await supabase
        .from('creative_assets')
        .select('parent_asset_id, status, is_favorite')
        .in('parent_asset_id', masterIds)
        .is('deleted_at', null);

      // Update counts
      for (const variation of variations || []) {
        // Find the group for this variation's parent
        const parent = masterAssets?.find(a => a.id === variation.parent_asset_id);
        if (parent) {
          const createdDate = new Date(parent.created_at).toISOString().split('T')[0];
          const groupKey = `${createdDate}|${parent.persona_id}|${parent.voice_id}`;
          const group = groups.get(groupKey);
          if (group) {
            group.variation_count++;
            group.total_count++;
            if (variation.status === 'approved' || variation.status === 'active') {
              group.approved_count++;
            }
            if (variation.is_favorite) {
              group.favorited_count++;
            }
          }
        }
      }
    }

    // Convert to array and sort by date descending
    const result = Array.from(groups.values()).sort((a, b) =>
      b.created_date.localeCompare(a.created_date)
    );

    return NextResponse.json({
      data: result,
      count: result.length,
      daysBack,
    });
  } catch (error) {
    console.error('[RSA Batches] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
