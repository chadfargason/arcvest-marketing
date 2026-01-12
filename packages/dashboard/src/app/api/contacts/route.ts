import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/contacts - List all contacts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching contacts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count, limit, offset });
  } catch (error) {
    console.error('Error in GET /api/contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Basic validation
    if (!body.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if contact already exists
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', body.email)
      .is('deleted_at', null)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Contact with this email already exists' }, { status: 409 });
    }

    // Round-robin assignment if not specified
    if (!body.assigned_to) {
      const { data: lastAssigned } = await supabase
        .from('system_state')
        .select('value')
        .eq('key', 'last_assigned_advisor')
        .single();

      const advisors = ['chad', 'erik'];
      const lastAdvisor = lastAssigned?.value || 'erik';
      const nextAdvisor = lastAdvisor === 'chad' ? 'erik' : 'chad';
      body.assigned_to = nextAdvisor;

      // Update last assigned
      await supabase
        .from('system_state')
        .upsert({ key: 'last_assigned_advisor', value: nextAdvisor });
    }

    // Set default status and score
    body.status = body.status || 'new_lead';
    body.lead_score = body.lead_score || 0;

    const { data, error } = await supabase
      .from('contacts')
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'contact',
      entity_id: data.id,
      action: 'created',
      details: { source: body.source },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
