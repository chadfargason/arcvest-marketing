/**
 * RSA Asset API - Single Asset Operations
 * GET - Fetch single asset with details
 * PUT - Update asset (favorite, rating, status, notes)
 * DELETE - Archive asset (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Fetch the asset
    const { data: asset, error } = await supabase
      .from('creative_assets')
      .select('*')
      .eq('id', id)
      .eq('asset_type', 'ad_copy')
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      console.error('[RSA Asset] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch related headlines
    const { data: headlines } = await supabase
      .from('rsa_headlines')
      .select('*')
      .eq('asset_id', id)
      .order('position', { ascending: true });

    // Fetch related descriptions
    const { data: descriptions } = await supabase
      .from('rsa_descriptions')
      .select('*')
      .eq('asset_id', id)
      .order('position', { ascending: true });

    // Fetch variations if this is a master
    let variations: unknown[] = [];
    if (asset.variation_type === 'master') {
      const { data: variationData } = await supabase
        .from('creative_assets')
        .select('id, name, status, variation_number, content, is_favorite, rating')
        .eq('parent_asset_id', id)
        .is('deleted_at', null)
        .order('variation_number', { ascending: true });

      variations = variationData || [];
    }

    return NextResponse.json({
      ...asset,
      headlines: headlines || [],
      descriptions: descriptions || [],
      variations,
    });
  } catch (error) {
    console.error('[RSA Asset] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabase();

    // Allowed update fields
    const allowedFields = ['is_favorite', 'rating', 'status', 'notes', 'name'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('creative_assets')
      .update(updateData)
      .eq('id', id)
      .eq('asset_type', 'ad_copy')
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      console.error('[RSA Asset] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[RSA Asset] Update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Soft delete by setting deleted_at
    const { data, error } = await supabase
      .from('creative_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('asset_type', 'ad_copy')
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      console.error('[RSA Asset] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: data.id });
  } catch (error) {
    console.error('[RSA Asset] Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
