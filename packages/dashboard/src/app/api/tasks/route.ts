import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tasks - List all tasks
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');
    const contactId = searchParams.get('contact_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email)
      `, { count: 'exact' })
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    } else {
      // By default, show pending tasks
      query = query.eq('status', 'pending');
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count, limit, offset });
  } catch (error) {
    console.error('Error in GET /api/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    body.status = body.status || 'pending';
    body.priority = body.priority || 'medium';

    const { data, error } = await supabase
      .from('tasks')
      .insert(body)
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'task',
      entity_id: data.id,
      action: 'created',
      details: { contact_id: body.contact_id },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
