import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const COMPLIANCE_SYSTEM_PROMPT = `You are a content writer for ArcVest, a fee-only fiduciary registered investment adviser (RIA).

IMPORTANT COMPLIANCE GUIDELINES:
- Never guarantee investment returns or outcomes
- Avoid predictions about market performance
- Do not use superlatives like "best," "top," or "leading" without substantiation
- Always maintain a balanced perspective on risks and benefits
- Do not provide specific investment recommendations
- Avoid testimonials unless properly disclosed
- Focus on education rather than promotion
- When discussing performance, include appropriate disclaimers
- Remember that past performance does not guarantee future results

BRAND VOICE:
- Professional but approachable
- Educational and helpful
- Trustworthy and transparent
- Client-focused, not sales-focused

TARGET AUDIENCE:
- Individuals and families planning for retirement
- Business owners seeking exit planning
- High-net-worth individuals needing comprehensive planning
- People seeking objective, unbiased financial advice`;

// POST /api/content/generate - Generate content using Claude AI
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to your Vercel environment variables.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { type, topic, targetKeyword, outline, keyPoints, tone } = body;

    if (!type) {
      return NextResponse.json({ error: 'Generation type is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    let prompt = '';
    let maxTokens = 4096;

    switch (type) {
      case 'outline':
        if (!topic) {
          return NextResponse.json({ error: 'Topic is required for outline generation' }, { status: 400 });
        }
        prompt = `Create a detailed outline for a blog post about "${topic}".

${targetKeyword ? `Target keyword: ${targetKeyword}` : ''}

Requirements:
- The blog post should be educational and informative
- Target audience: individuals planning for retirement or seeking financial advice
- Avoid sales language; focus on providing genuine value
- Include 4-6 main sections with subsections
- Each section should have a clear purpose

Format the outline with clear headings and bullet points.`;
        maxTokens = 2048;
        break;

      case 'blog_post':
        if (!outline && !topic) {
          return NextResponse.json({ error: 'Outline or topic is required for blog post generation' }, { status: 400 });
        }
        prompt = outline
          ? `Write a complete blog post based on the following outline:

${outline}

Topic: ${topic || 'See outline'}
${targetKeyword ? `Target keyword: ${targetKeyword}` : ''}

Requirements:
- Write in a professional but approachable tone
- Target length: 1200-1500 words
- Include the target keyword naturally (3-5 times) if provided
- Avoid making specific predictions about market performance
- Do not guarantee any investment outcomes
- Include a brief disclaimer at the end
- End with a subtle call-to-action about learning more

Write the complete blog post in markdown format.`
          : `Write a complete blog post about "${topic}".

${targetKeyword ? `Target keyword: ${targetKeyword}` : ''}

Requirements:
- Write in a professional but approachable tone
- Target length: 1200-1500 words
- Include the target keyword naturally (3-5 times) if provided
- Structure with clear headings (H2, H3)
- Avoid making specific predictions about market performance
- Do not guarantee any investment outcomes
- Include a brief disclaimer at the end
- End with a subtle call-to-action about learning more

Write the complete blog post in markdown format.`;
        maxTokens = 4096;
        break;

      case 'linkedin_post':
        if (!topic) {
          return NextResponse.json({ error: 'Topic is required for LinkedIn post' }, { status: 400 });
        }
        prompt = `Write a LinkedIn post about "${topic}".

${keyPoints && keyPoints.length > 0 ? `Key points to cover:\n${keyPoints.map((p: string) => `- ${p}`).join('\n')}` : ''}

Tone: ${tone || 'educational'}

Requirements:
- Keep under 1300 characters for optimal visibility
- Start with a compelling hook
- Use short paragraphs and line breaks for readability
- End with a question or call-to-action to encourage engagement
- Include 3-5 relevant hashtags at the end
- Avoid promotional language
- No performance guarantees or predictions

Write the complete LinkedIn post.`;
        maxTokens = 1024;
        break;

      case 'newsletter':
        if (!topic) {
          return NextResponse.json({ error: 'Topic/theme is required for newsletter' }, { status: 400 });
        }
        prompt = `Write a monthly newsletter for a fee-only financial planning firm.

Theme: ${topic}

Requirements:
- Include a warm introduction (50-75 words)
- Include a market update section (150-200 words) - factual, balanced, no predictions
- Include a featured tip section (75-100 words)
- Include a closing paragraph
- Professional but approachable tone
- Focus on education, not promotion
- No specific investment recommendations

Write the complete newsletter in markdown format with clear section headings.`;
        maxTokens = 3000;
        break;

      case 'compliance_check':
        if (!body.content) {
          return NextResponse.json({ error: 'Content is required for compliance check' }, { status: 400 });
        }
        const checkResponse = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          temperature: 0.3,
          system: 'You are a compliance reviewer specializing in SEC Marketing Rule and FINRA regulations for investment advisers.',
          messages: [{
            role: 'user',
            content: `Review the following financial services marketing content for SEC Marketing Rule compliance issues:

${body.content}

Check for:
1. Performance guarantees or promises of specific returns
2. Misleading statements about risk
3. Unsubstantiated claims
4. Missing required disclosures
5. Testimonials without proper disclosure (if applicable)
6. Superlatives like "best," "top," or "leading" without substantiation
7. Cherry-picked performance data
8. Predictions presented as facts

Respond in JSON format:
{
  "passed": true/false,
  "issues": ["list of specific issues found"],
  "suggestions": ["list of suggested fixes"]
}

If the content passes compliance review, issues and suggestions can be empty arrays.`
          }]
        });

        const checkText = checkResponse.content.find(c => c.type === 'text');
        if (checkText && checkText.type === 'text') {
          try {
            const jsonMatch = checkText.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return NextResponse.json({
                compliance: JSON.parse(jsonMatch[0]),
                usage: {
                  inputTokens: checkResponse.usage.input_tokens,
                  outputTokens: checkResponse.usage.output_tokens,
                }
              });
            }
          } catch {
            // Fall through to default response
          }
        }
        return NextResponse.json({
          compliance: {
            passed: false,
            issues: ['Unable to parse compliance check results'],
            suggestions: ['Manual review required']
          }
        });

      default:
        return NextResponse.json({ error: `Unknown generation type: ${type}` }, { status: 400 });
    }

    // Generate content
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature: 0.7,
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No content generated' }, { status: 500 });
    }

    return NextResponse.json({
      content: textContent.text,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }
    });

  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content' },
      { status: 500 }
    );
  }
}
