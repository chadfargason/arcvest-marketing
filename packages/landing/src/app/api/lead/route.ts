import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createContact } from '@/lib/ghl-client';

const leadSchema = z.object({
  firstName: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Valid phone number is required').max(20),
  pageSource: z.enum(['retirement', 'wealth-management']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = leadSchema.parse(body);

    const tags =
      data.pageSource === 'retirement'
        ? ['retirement-planning-lead', 'google-ads']
        : ['hnw-fee-conscious-lead', 'google-ads'];

    const source =
      data.pageSource === 'retirement'
        ? 'Landing Page - Retirement Planning'
        : 'Landing Page - Wealth Management';

    const result = await createContact({
      firstName: data.firstName,
      email: data.email,
      phone: data.phone,
      tags,
      source,
    });

    return NextResponse.json({
      success: true,
      contactId: result.contact.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    console.error('Lead submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
