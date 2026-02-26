/**
 * Facebook Leads Sync Cron
 *
 * Polls Meta Lead Forms every 15 minutes for new submissions,
 * then creates contacts in GoHighLevel CRM with appropriate tags.
 *
 * Schedule: Every 15 minutes (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

async function createGhlContact(params: {
  firstName: string;
  email: string;
  phone: string;
  tags: string[];
  source: string;
  customFields?: Record<string, string>;
}) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    throw new Error('GHL_API_KEY or GHL_LOCATION_ID not set');
  }

  const response = await fetch(`${GHL_BASE_URL}/contacts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: GHL_API_VERSION,
    },
    body: JSON.stringify({
      locationId,
      firstName: params.firstName,
      email: params.email,
      phone: params.phone,
      tags: params.tags,
      source: params.source,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GHL createContact failed (${response.status}): ${error}`);
  }

  return response.json() as Promise<{ contact: { id: string } }>;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('[FB Leads Sync] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadFormId = process.env.META_LEAD_FORM_ID;
  if (!leadFormId) {
    console.error('[FB Leads Sync] META_LEAD_FORM_ID not set');
    return NextResponse.json({ error: 'META_LEAD_FORM_ID not configured' }, { status: 500 });
  }

  console.log(`[FB Leads Sync] Starting (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})...`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  try {
    // Get last poll timestamp from activity_log
    const { data: lastSync } = await supabase
      .from('activity_log')
      .select('created_at')
      .eq('action', 'fb_leads_sync_complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const sinceTimestamp = lastSync
      ? Math.floor(new Date(lastSync.created_at).getTime() / 1000)
      : Math.floor((Date.now() - 15 * 60 * 1000) / 1000); // Default: last 15 min

    // Fetch new leads from Meta
    const service = getMetaAdsService();
    service.initializeFromEnv();
    const leads = await service.getLeads(leadFormId, sinceTimestamp);

    console.log(`[FB Leads Sync] Found ${leads.length} new leads since ${new Date(sinceTimestamp * 1000).toISOString()}`);

    let synced = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        // Extract field data
        const fields: Record<string, string> = {};
        for (const field of lead.field_data || []) {
          fields[field.name] = field.values?.[0] || '';
        }

        const firstName = fields['first_name'] || fields['full_name']?.split(' ')[0] || 'Unknown';
        const email = fields['email'] || '';
        const phone = fields['phone_number'] || '';

        if (!email) {
          console.warn(`[FB Leads Sync] Lead ${lead.id} has no email, skipping GHL sync`);
          continue;
        }

        // Create contact in GHL
        await createGhlContact({
          firstName,
          email,
          phone,
          tags: ['fb-retirement-lead', 'facebook-ads'],
          source: 'Facebook Lead Ad - Retirement Checklist',
        });

        synced++;
        console.log(`[FB Leads Sync] Synced lead: ${firstName} (${email})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[FB Leads Sync] Failed to sync lead ${lead.id}: ${msg}`);
        errors.push(`lead ${lead.id}: ${msg}`);
      }
    }

    // Log sync result
    await supabase.from('activity_log').insert({
      actor: 'fb_leads_cron',
      action: 'fb_leads_sync_complete',
      entity_type: 'fb_leads',
      details: {
        lead_form_id: leadFormId,
        leads_found: leads.length,
        leads_synced: synced,
        errors,
        trigger: vercelCronHeader === '1' ? 'cron' : 'manual',
      },
    });

    console.log(`[FB Leads Sync] Complete. Found: ${leads.length}, Synced to GHL: ${synced}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      leads_found: leads.length,
      leads_synced: synced,
      errors,
    });
  } catch (error) {
    console.error('[FB Leads Sync] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'FB leads sync failed',
      },
      { status: 500 },
    );
  }
}
