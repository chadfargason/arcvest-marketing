/**
 * Email Update API
 * 
 * PATCH /api/lead-finder/emails/:leadId - Update email draft (user edits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = await request.json();

    // Get the latest email version
    const { data: latestEmail, error: fetchError } = await supabase
      .from('lead_finder_emails')
      .select('id, version')
      .eq('lead_id', leadId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !latestEmail) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Update allowed fields
    const updates: Record<string, unknown> = {
      edited_by_user: true,
    };

    if (body.subject !== undefined) {
      updates.subject = body.subject;
    }
    if (body.body_html !== undefined) {
      updates.body_html = body.body_html;
    }
    if (body.body_plain !== undefined) {
      updates.body_plain = body.body_plain;
    }

    const { data, error } = await supabase
      .from('lead_finder_emails')
      .update(updates)
      .eq('id', latestEmail.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating email:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in email update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
