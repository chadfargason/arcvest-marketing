/**
 * RSA Assets API
 * GET - List assets with filters
 * POST - Bulk actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const personas = searchParams.get('personas')?.split(',').filter(Boolean) || [];
    const voices = searchParams.get('voices')?.split(',').filter(Boolean) || [];
    const status = searchParams.get('status') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const favoritesOnly = searchParams.get('favorites') === 'true';
    const minRating = searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!) : null;
    const variationType = searchParams.get('variationType') || 'all';
    const search = searchParams.get('search') || '';

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabase();

    // Build query
    let query = supabase
      .from('creative_assets')
      .select('*', { count: 'exact' })
      .eq('asset_type', 'ad_copy')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Apply filters
    if (personas.length > 0) {
      query = query.in('persona_id', personas);
    }

    if (voices.length > 0) {
      query = query.in('voice_id', voices);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    if (favoritesOnly) {
      query = query.eq('is_favorite', true);
    }

    if (minRating !== null) {
      query = query.gte('rating', minRating);
    }

    if (variationType !== 'all') {
      query = query.eq('variation_type', variationType);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[RSA Assets] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[RSA Assets] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetIds, action } = body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: 'assetIds required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    const supabase = getSupabase();

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve':
        updateData = { status: 'approved' };
        break;
      case 'reject':
        updateData = { status: 'draft' };
        break;
      case 'favorite':
        updateData = { is_favorite: true };
        break;
      case 'unfavorite':
        updateData = { is_favorite: false };
        break;
      case 'archive':
        updateData = { status: 'retired' };
        break;
      case 'delete':
        updateData = { deleted_at: new Date().toISOString() };
        break;
      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('creative_assets')
      .update(updateData)
      .in('id', assetIds)
      .select();

    if (error) {
      console.error('[RSA Assets] Bulk action error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    });
  } catch (error) {
    console.error('[RSA Assets] Bulk action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
