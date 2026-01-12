import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/contacts/[id]/interactions - Get interactions for a contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching interactions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/contacts/[id]/interactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/contacts/[id]/interactions - Add an interaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    body.contact_id = id;

    const { data, error } = await supabase
      .from('interactions')
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error('Error creating interaction:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update lead score based on interaction type
    const scorePoints: Record<string, number> = {
      email_opened: 5,
      email_clicked: 10,
      form_submission: 30,
      page_view: 2,
      email_outbound: 3,
      call_outbound: 5,
      meeting: 20,
      consultation: 25,
    };

    const points = scorePoints[body.type] || 0;
    if (points > 0) {
      await supabase.rpc('increment_lead_score', { contact_id: id, points });
    }

    // Update contact's last_activity_at
    await supabase
      .from('contacts')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/contacts/[id]/interactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
