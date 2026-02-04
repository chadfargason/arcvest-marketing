/**
 * Lead Finder Single Lead API
 * 
 * GET /api/lead-finder/leads/:id - Get single lead
 * PATCH /api/lead-finder/leads/:id - Update lead status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { id } = await params;

    const { data, error } = await supabase
      .from('lead_finder_leads')
      .select(`
        *,
        lead_finder_emails (
          id,
          version,
          subject,
          body_html,
          body_plain,
          tone,
          edited_by_user,
          created_at
        ),
        lead_finder_runs (
          id,
          run_date,
          geo_name,
          trigger_focus
        ),
        lead_finder_pages (
          id,
          url,
          page_title,
          extracted_text
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching lead:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { id } = await params;
    const body = await request.json();

    // Allowed update fields
    const allowedFields = ['outreach_status', 'sent_at', 'response_at'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Handle marking as sent
    if (body.outreach_status === 'sent' && !body.sent_at) {
      updates.sent_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('lead_finder_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in lead update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
