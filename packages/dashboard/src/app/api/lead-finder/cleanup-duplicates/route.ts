/**
 * Cleanup Duplicates API
 * 
 * DELETE /api/lead-finder/cleanup-duplicates - Remove duplicate leads
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get all leads
    const { data: leads, error: fetchError } = await supabase
      .from('lead_finder_leads')
      .select('id, full_name, company, created_at')
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!leads) {
      return NextResponse.json({ message: 'No leads found' });
    }

    // Track unique names (keep first occurrence, delete rest)
    const seenNames = new Map<string, string>(); // name -> id to keep
    const idsToDelete: string[] = [];

    for (const lead of leads) {
      const normalizedName = lead.full_name.toLowerCase().trim();
      
      if (seenNames.has(normalizedName)) {
        // Duplicate - mark for deletion
        idsToDelete.push(lead.id);
      } else {
        // First occurrence - keep it
        seenNames.set(normalizedName, lead.id);
      }
    }

    // Delete duplicates
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('lead_finder_leads')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      duplicatesRemoved: idsToDelete.length,
      uniqueLeadsKept: seenNames.size,
      message: `Removed ${idsToDelete.length} duplicate leads, kept ${seenNames.size} unique leads`,
    });
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
