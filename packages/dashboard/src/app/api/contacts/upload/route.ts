import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ContactRow {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  source?: string;
  notes?: string;
}

// POST /api/contacts/upload - Bulk create contacts from CSV data
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { contacts } = body as { contacts: ContactRow[] };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      );
    }

    // Validate required fields
    const validContacts: ContactRow[] = [];
    const errors: { row: number; error: string }[] = [];

    contacts.forEach((contact, index) => {
      if (!contact.first_name?.trim()) {
        errors.push({ row: index + 1, error: 'Missing first name' });
        return;
      }
      if (!contact.last_name?.trim()) {
        errors.push({ row: index + 1, error: 'Missing last name' });
        return;
      }
      if (!contact.email?.trim()) {
        errors.push({ row: index + 1, error: 'Missing email' });
        return;
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
        errors.push({ row: index + 1, error: 'Invalid email format' });
        return;
      }
      validContacts.push(contact);
    });

    if (validContacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts to import', errors },
        { status: 400 }
      );
    }

    // Get current assignment state for round-robin
    const { data: systemState } = await supabase
      .from('system_state')
      .select('value')
      .eq('key', 'last_assigned_to')
      .single();

    let lastAssigned = systemState?.value || 'erik';
    const teamMembers = ['chad', 'erik'];

    // Prepare contacts for insertion
    const contactsToInsert = validContacts.map((contact) => {
      // Round-robin assignment
      const currentIndex = teamMembers.indexOf(lastAssigned);
      const nextIndex = (currentIndex + 1) % teamMembers.length;
      lastAssigned = teamMembers[nextIndex];

      return {
        first_name: contact.first_name.trim(),
        last_name: contact.last_name.trim(),
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone?.trim() || null,
        source: contact.source?.trim() || 'csv_import',
        notes: contact.notes?.trim() || null,
        status: 'new_lead',
        lead_score: 0,
        assigned_to: lastAssigned,
      };
    });

    // Check for duplicate emails
    const emails = contactsToInsert.map(c => c.email);
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('email')
      .in('email', emails);

    const existingEmails = new Set(existingContacts?.map(c => c.email) || []);
    const newContacts = contactsToInsert.filter(c => !existingEmails.has(c.email));
    const skippedCount = contactsToInsert.length - newContacts.length;

    if (newContacts.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: skippedCount,
        errors,
        message: 'All contacts already exist in the database',
      });
    }

    // Insert contacts
    const { data, error } = await supabase
      .from('contacts')
      .insert(newContacts)
      .select();

    if (error) {
      console.error('Error inserting contacts:', error);
      return NextResponse.json(
        { error: 'Failed to import contacts', details: error.message },
        { status: 500 }
      );
    }

    // Update last assigned state
    await supabase
      .from('system_state')
      .upsert({ key: 'last_assigned_to', value: lastAssigned });

    // Log activity for each imported contact
    const activityLogs = data.map((contact) => ({
      contact_id: contact.id,
      action: 'contact_created',
      description: 'Contact imported via CSV upload',
      metadata: { source: 'csv_import' },
    }));

    await supabase.from('activity_log').insert(activityLogs);

    return NextResponse.json({
      success: true,
      imported: data.length,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${data.length} contact${data.length !== 1 ? 's' : ''}${skippedCount > 0 ? `, skipped ${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''}` : ''}`,
    });
  } catch (error) {
    console.error('Error in POST /api/contacts/upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
