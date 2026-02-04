/**
 * Batch Email Prediction Test
 * 
 * GET /api/test/email-predict-batch - Test AI email prediction on all existing leads
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for batch processing

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');

  console.log(`🧪 Testing email prediction on up to ${limit} leads...`);

  try {
    // Fetch leads from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: leads, error } = await supabase
      .from('lead_finder_leads')
      .select('id, full_name, title, company, contact_paths')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !leads) {
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    console.log(`📊 Testing ${leads.length} leads...`);

    // Import Anthropic
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      console.log(`[${i + 1}/${leads.length}] Testing ${lead.full_name} at ${lead.company}...`);

      try {
        // Check if lead already has emails
        const existingEmails = (lead.contact_paths || []).filter((cp: { type: string; value: string }) => 
          cp.type === 'generic_email' || cp.type === 'predicted_email'
        );

        const prompt = `Help me make an educated guess at the email address for this person:

Name: ${lead.full_name}
Title: ${lead.title || 'Unknown'}
Organization: ${lead.company || 'Unknown'}

Please provide the 3-4 most likely email addresses for this person, ordered by likelihood.

Consider:
- Universities typically use .edu domains (e.g., ttu.edu for Texas Tech)
- Non-profits may use .org
- Government entities use .gov
- Corporations usually use .com
- Common formats: first.last@domain, flast@domain, firstname.lastname@domain
- Handle hyphenated names, apostrophes, and special characters appropriately
- For universities, check if there are common abbreviations (e.g., "Texas Tech University" = ttu.edu)

Respond with ONLY a JSON array of email addresses, nothing else.
Example: ["john.smith@company.com", "jsmith@company.com", "johnsmith@company.com"]`;

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: prompt,
          }],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          const jsonMatch = content.text.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const predictedEmails = JSON.parse(jsonMatch[0]) as string[];
            const validEmails = predictedEmails.filter(e => e && e.includes('@') && e.includes('.'));
            
            if (validEmails.length > 0) {
              // Save predictions to database
              const newContactPaths = validEmails.map(email => ({
                type: 'predicted_email',
                value: email,
                confidence: 'ai_predicted',
                source: 'sonnet_4_batch',
              }));

              // Merge with existing contact paths
              const updatedContactPaths = [
                ...(lead.contact_paths || []),
                ...newContactPaths,
              ];

              // Update the lead in database
              const { error: updateError } = await supabase
                .from('lead_finder_leads')
                .update({ contact_paths: updatedContactPaths })
                .eq('id', lead.id);

              if (updateError) {
                console.error(`   ❌ Failed to save predictions:`, updateError);
              } else {
                console.log(`   ✅ Predicted and saved ${validEmails.length} emails to database`);
              }

              successCount++;
              results.push({
                name: lead.full_name,
                company: lead.company,
                existingEmails: existingEmails.length,
                predictedEmails: validEmails,
                savedToDatabase: !updateError,
                status: 'success',
              });
            } else {
              failureCount++;
              results.push({
                name: lead.full_name,
                company: lead.company,
                existingEmails: existingEmails.length,
                error: 'No valid emails in response',
                status: 'failed',
              });
              console.log(`   ❌ No valid emails`);
            }
          } else {
            failureCount++;
            results.push({
              name: lead.full_name,
              company: lead.company,
              existingEmails: existingEmails.length,
              error: 'No JSON in response',
              aiResponse: content.text,
              status: 'failed',
            });
            console.log(`   ❌ No JSON in response`);
          }
        }
      } catch (error) {
        failureCount++;
        results.push({
          name: lead.full_name,
          company: lead.company,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'error',
        });
        console.error(`   ❌ Error:`, error);
      }

      // Small delay to avoid rate limiting
      if (i < leads.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const savedCount = results.filter(r => r.savedToDatabase).length;
    console.log(`\n📊 Summary: ${successCount} success, ${failureCount} failures out of ${leads.length} total`);
    console.log(`💾 Saved ${savedCount} predictions to database`);

    return NextResponse.json({
      success: true,
      summary: {
        total: leads.length,
        successful: successCount,
        failed: failureCount,
        savedToDatabase: savedCount,
        successRate: `${Math.round((successCount / leads.length) * 100)}%`,
      },
      results: results,
    });

  } catch (error) {
    console.error('❌ Batch test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
