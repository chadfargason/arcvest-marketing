/**
 * Email Regeneration API
 * 
 * POST /api/lead-finder/emails/:leadId/regenerate - Generate new email draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EmailTone = 'congratulatory' | 'value_first' | 'peer_credibility' | 'direct_curious';

const TONE_INSTRUCTIONS: Record<EmailTone, string> = {
  congratulatory: `
TONE: Warm & Congratulatory
- Open by genuinely acknowledging their recent achievement/transition
- Express interest in learning about their journey
- Subtly mention how transitions often create planning opportunities
- Keep it brief and personal, not salesy
- CTA: Offer a brief conversation to learn more about their plans
`,
  value_first: `
TONE: Value-First
- Lead with a specific insight or challenge relevant to their situation
- Show expertise without being condescending
- Reference the type of decisions someone in their position typically faces
- Position the conversation as educational/consultative
- CTA: Offer to share insights specific to their situation
`,
  peer_credibility: `
TONE: Peer Credibility
- Reference working with others in similar roles/industries (without naming)
- Share a relevant pattern or insight from that experience
- Make them feel understood and that you "get" their world
- Keep it collegial, like peer-to-peer
- CTA: Offer to compare notes or share what's worked for others
`,
  direct_curious: `
TONE: Direct & Curious
- Be direct about why you're reaching out
- Express genuine curiosity about their situation/plans
- Ask a thoughtful question related to their trigger event
- Keep it short and unpretentious
- CTA: Simple ask for a brief call to learn more
`,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { leadId } = await params;
    const body = await request.json();
    const tone = (body.tone as EmailTone) || 'congratulatory';

    // Validate tone
    if (!['congratulatory', 'value_first', 'peer_credibility', 'direct_curious'].includes(tone)) {
      return NextResponse.json({ error: 'Invalid tone' }, { status: 400 });
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('lead_finder_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Get current max version
    const { data: currentEmails } = await supabase
      .from('lead_finder_emails')
      .select('version')
      .eq('lead_id', leadId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (currentEmails?.[0]?.version || 0) + 1;

    // Generate new email
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const firstName = lead.full_name.split(' ')[0];
    const toneInstructions = TONE_INSTRUCTIONS[tone];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20251022', // Upgraded to Sonnet 4.5
      max_tokens: 1000,
      system: `You are a copywriter for ArcVest, a Texas-based wealth management firm. Write personalized outreach emails to potential high-net-worth clients.

CRITICAL RULES:
1. Keep emails SHORT (100-150 words max for body)
2. Sound like a real person, not a marketing template
3. Reference their specific trigger event naturally
4. Never be salesy or pushy
5. Subject lines should be 5-8 words max, feel personal
6. Sign as "Chad Fargason" with title "Partner, ArcVest"`,
      messages: [
        {
          role: 'user',
          content: `Write an outreach email for this lead:

NAME: ${firstName}
TITLE: ${lead.title || 'Executive'}
COMPANY: ${lead.company || 'their organization'}
LOCATION: ${lead.geo_signal || 'Texas'}
TRIGGER TYPE: ${lead.trigger_type}
TRIGGER CONTEXT: ${lead.rationale_detail || lead.rationale_short}

${toneInstructions}

Return JSON with this exact structure:
{
  "subject": "Subject line here",
  "bodyHtml": "<p>Email body with HTML formatting...</p><p>Signature...</p>",
  "bodyPlain": "Plain text version of the email..."
}`,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Failed to generate email' }, { status: 500 });
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse email response' }, { status: 500 });
    }

    const emailData = JSON.parse(jsonMatch[0]);

    // Save new email version
    const { data: newEmail, error: insertError } = await supabase
      .from('lead_finder_emails')
      .insert({
        lead_id: leadId,
        version: nextVersion,
        subject: emailData.subject,
        body_html: emailData.bodyHtml,
        body_plain: emailData.bodyPlain,
        tone,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving email:', insertError);
      return NextResponse.json({ error: 'Failed to save email' }, { status: 500 });
    }

    return NextResponse.json({ data: newEmail });
  } catch (error) {
    console.error('Error regenerating email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
