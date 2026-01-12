import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/content - Get content calendar items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const contentType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('content_calendar')
      .select('*')
      .order('scheduled_date', { ascending: true, nullsFirst: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (contentType && contentType !== 'all') {
      query = query.eq('content_type', contentType);
    }
    if (startDate) {
      query = query.gte('scheduled_date', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching content:', error);
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }

    return NextResponse.json({ content: data || [] });
  } catch (error) {
    console.error('Error in GET /api/content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/content - Create new content item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('content_calendar')
      .insert({
        title: body.title,
        content_type: body.content_type,
        status: body.status || 'idea',
        scheduled_date: body.scheduled_date || null,
        topic: body.topic || null,
        target_keyword: body.target_keyword || null,
        outline: body.outline || null,
        draft: body.draft || null,
        keywords: body.keywords || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating content:', error);
      return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
    }

    return NextResponse.json({ content: data });
  } catch (error) {
    console.error('Error in POST /api/content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
