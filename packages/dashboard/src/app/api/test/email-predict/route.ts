/**
 * Test Email Prediction Directly
 * 
 * GET /api/test/email-predict - Test AI email prediction with logging
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name') || 'Elizabeth Trejos-Castillo';
  const title = searchParams.get('title') || 'Fulbright Scholar Liaison';
  const company = searchParams.get('company') || 'Texas Tech University';

  console.log(`🧪 Testing email prediction for: ${name} at ${company}`);

  try {
    // Import Anthropic
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = `Help me make an educated guess at the email address for this person:

Name: ${name}
Title: ${title}
Organization: ${company}

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
Example: ["elizabeth.trejos-castillo@ttu.edu", "e.trejos-castillo@ttu.edu", "etrejos-castillo@ttu.edu"]`;

    console.log('📤 Sending prompt to Claude Sonnet...');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      console.log('📥 AI Response:', content.text);
      
      // Parse JSON response
      const jsonMatch = content.text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const predictedEmails = JSON.parse(jsonMatch[0]) as string[];
          const validEmails = predictedEmails.filter(e => e && e.includes('@') && e.includes('.'));
          
          console.log('✅ Parsed emails:', validEmails);

          return NextResponse.json({
            success: true,
            input: { name, title, company },
            aiResponse: content.text,
            parsedEmails: validEmails,
            prompt: prompt,
          });
        } catch (parseError) {
          console.error('❌ Failed to parse JSON:', parseError);
          return NextResponse.json({
            success: false,
            error: 'Failed to parse AI response as JSON',
            aiResponse: content.text,
            prompt: prompt,
          }, { status: 500 });
        }
      } else {
        console.warn('⚠️ No JSON array found in AI response');
        return NextResponse.json({
          success: false,
          error: 'No JSON array found in AI response',
          aiResponse: content.text,
          prompt: prompt,
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Unexpected response type from AI',
    }, { status: 500 });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
