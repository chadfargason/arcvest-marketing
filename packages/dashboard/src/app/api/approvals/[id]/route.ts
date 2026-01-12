import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PUT /api/approvals/[id] - Update approval (approve/reject)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { action, feedback } = body;

    if (!action || !['approve', 'reject', 'request_revision'].includes(action)) {
      return NextResponse.json({ error: 'Valid action required (approve, reject, request_revision)' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_requested',
      reviewed_at: new Date().toISOString(),
      reviewed_by: body.reviewed_by || 'system',
    };

    if (feedback) {
      updateData.feedback = feedback;
    }

    const { data, error } = await supabase
      .from('approval_queue')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
      }
      console.error('Error updating approval:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'approval',
      entity_id: id,
      action: action,
      details: { type: data.type, feedback },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in PUT /api/approvals/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
