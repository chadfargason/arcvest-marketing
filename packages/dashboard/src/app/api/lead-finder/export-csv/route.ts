/**
 * Lead Finder CSV Export API
 * 
 * GET /api/lead-finder/export-csv
 * 
 * Exports all leads to CSV format with all fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch all leads with related data
    const { data: leads, error } = await supabase
      .from('lead_finder_leads')
      .select(`
        *,
        lead_finder_runs(geo_name, trigger_focus, run_date),
        lead_finder_emails(id, subject, tone, version)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CSV Export] Error fetching leads:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads found' }, { status: 404 });
    }

    // Convert to CSV
    const csv = convertLeadsToCSV(leads);

    // Return as downloadable CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="arcvest-leads-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('[CSV Export] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Export failed'
    }, { status: 500 });
  }
}

function convertLeadsToCSV(leads: any[]): string {
  // Define CSV headers
  const headers = [
    'ID',
    'Full Name',
    'Title',
    'Company',
    'Location',
    'Trigger Type',
    'Category',
    'Score',
    'Tier',
    'Rationale Short',
    'Rationale Detail',
    'Email 1 (Type)',
    'Email 1 (Address)',
    'Email 2 (Type)',
    'Email 2 (Address)',
    'Email 3 (Type)',
    'Email 3 (Address)',
    'Email 4 (Type)',
    'Email 4 (Address)',
    'All Email Addresses',
    'Phone',
    'LinkedIn',
    'Website',
    'Other Contact Info',
    'Draft Email Subject',
    'Draft Email Body (Plain Text)',
    'Draft Email Body (HTML)',
    'Draft Email Tone',
    'Source URL',
    'Source Title',
    'Outreach Status',
    'Sent At',
    'Response At',
    'Run Date',
    'Run Geo',
    'Run Trigger',
    'Created At',
  ];

  // Build CSV rows
  const rows = leads.map(lead => {
    // Extract emails from contact_paths
    const emails = (lead.contact_paths || []).filter((cp: any) => 
      cp.type === 'generic_email' || cp.type === 'predicted_email'
    );
    
    const phones = (lead.contact_paths || []).filter((cp: any) => cp.type === 'phone');
    const linkedins = (lead.contact_paths || []).filter((cp: any) => cp.type === 'linkedin');
    const websites = (lead.contact_paths || []).filter((cp: any) => cp.type === 'website');
    const others = (lead.contact_paths || []).filter((cp: any) => 
      !['generic_email', 'predicted_email', 'phone', 'linkedin', 'website'].includes(cp.type)
    );

    // Get all email addresses as a comma-separated list
    const allEmails = emails.map((e: any) => e.value).join('; ');

    // Get the latest email draft (highest version number)
    const emailDrafts = lead.lead_finder_emails || [];
    const latestDraft = emailDrafts.length > 0 
      ? emailDrafts.reduce((latest: any, current: any) => 
          current.version > latest.version ? current : latest
        )
      : null;

    return [
      lead.id,
      escapeCsvField(lead.full_name),
      escapeCsvField(lead.title),
      escapeCsvField(lead.company),
      escapeCsvField(lead.geo_signal),
      lead.trigger_type,
      lead.category,
      lead.score,
      lead.tier,
      escapeCsvField(lead.rationale_short),
      escapeCsvField(lead.rationale_detail),
      // Email 1
      emails[0]?.type || '',
      escapeCsvField(emails[0]?.value || ''),
      // Email 2
      emails[1]?.type || '',
      escapeCsvField(emails[1]?.value || ''),
      // Email 3
      emails[2]?.type || '',
      escapeCsvField(emails[2]?.value || ''),
      // Email 4
      emails[3]?.type || '',
      escapeCsvField(emails[3]?.value || ''),
      // All emails combined
      escapeCsvField(allEmails),
      // Other contact info
      escapeCsvField(phones.map((p: any) => p.value).join('; ')),
      escapeCsvField(linkedins.map((l: any) => l.value).join('; ')),
      escapeCsvField(websites.map((w: any) => w.value).join('; ')),
      escapeCsvField(others.map((o: any) => `${o.type}: ${o.value}`).join('; ')),
      // Draft email content
      escapeCsvField(latestDraft?.subject || ''),
      escapeCsvField(latestDraft?.body_plain || ''),
      escapeCsvField(latestDraft?.body_html || ''),
      latestDraft?.tone || '',
      // Source & status
      escapeCsvField(lead.source_url),
      escapeCsvField(lead.source_title),
      lead.outreach_status,
      lead.sent_at || '',
      lead.response_at || '',
      // Run info
      lead.lead_finder_runs?.run_date || '',
      lead.lead_finder_runs?.geo_name || '',
      lead.lead_finder_runs?.trigger_focus || '',
      lead.created_at,
    ];
  });

  // Combine headers and rows
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ];

  return csvLines.join('\n');
}

/**
 * Escape CSV field - handle quotes, commas, newlines
 */
function escapeCsvField(value: string | null | undefined): string {
  if (!value) return '';
  
  const stringValue = String(value);
  
  // If the field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}
