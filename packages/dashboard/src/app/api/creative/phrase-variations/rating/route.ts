/**
 * Phrase Variation Rating API
 * PATCH /api/creative/phrase-variations/rating
 *
 * Rate a phrase variation (1-5 stars).
 * Rating 1 = rejected (soft deleted and added to rejected phrases list)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!url || !key) throw new Error('Missing Supabase credentials');
    supabase = createClient(url, key);
  }
  return supabase;
}

interface RatingRequest {
  variationId: string;
  rating: number; // 1-5
  reason?: string; // Optional reason for rejection
}

export async function PATCH(request: NextRequest) {
  try {
    const body: RatingRequest = await request.json();
    const { variationId, rating, reason } = body;

    if (!variationId) {
      return NextResponse.json(
        { error: 'variationId is required' },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Fetch the variation to get its text
    const { data: variation, error: fetchError } = await getSupabase()
      .from('phrase_variations')
      .select('*')
      .eq('id', variationId)
      .single();

    if (fetchError || !variation) {
      return NextResponse.json(
        { error: 'Variation not found' },
        { status: 404 }
      );
    }

    // Update the rating
    const updateData: Record<string, unknown> = {
      rating,
      rated_at: new Date().toISOString(),
    };

    // If rating is 1, mark as rejected
    if (rating === 1) {
      updateData.is_rejected = true;
      updateData.rejected_at = new Date().toISOString();

      // Add to rejected phrases list
      await getSupabase()
        .from('rejected_phrases')
        .upsert({
          phrase: variation.variation_text,
          reason: reason || 'Rated 1 star',
          original_seed_phrase: variation.seed_phrase,
          original_variation_id: variation.id,
        }, {
          onConflict: 'phrase',
        });
    }

    const { error: updateError } = await getSupabase()
      .from('phrase_variations')
      .update(updateData)
      .eq('id', variationId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      variationId,
      rating,
      isRejected: rating === 1,
      message: rating === 1
        ? 'Variation rejected and added to exclusion list'
        : 'Rating saved',
    });
  } catch (error) {
    console.error('[PhraseRating] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint - permanently delete a variation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const variationId = searchParams.get('variationId');

    if (!variationId) {
      return NextResponse.json(
        { error: 'variationId is required' },
        { status: 400 }
      );
    }

    // Fetch the variation first
    const { data: variation } = await getSupabase()
      .from('phrase_variations')
      .select('*')
      .eq('id', variationId)
      .single();

    if (!variation) {
      return NextResponse.json(
        { error: 'Variation not found' },
        { status: 404 }
      );
    }

    // Delete the variation
    const { error: deleteError } = await getSupabase()
      .from('phrase_variations')
      .delete()
      .eq('id', variationId);

    if (deleteError) {
      throw deleteError;
    }

    // Also add to rejected list to prevent regeneration
    await getSupabase()
      .from('rejected_phrases')
      .upsert({
        phrase: variation.variation_text,
        reason: 'Manually deleted',
        original_seed_phrase: variation.seed_phrase,
      }, {
        onConflict: 'phrase',
      });

    return NextResponse.json({
      success: true,
      message: 'Variation deleted and added to exclusion list',
    });
  } catch (error) {
    console.error('[PhraseRating] DELETE Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
