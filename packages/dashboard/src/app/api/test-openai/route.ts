import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// GET /api/test-openai - Test GPT-5.2 with reasoning parameters
export async function GET() {
  const startTime = Date.now();

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY not configured',
      });
    }

    const openai = new OpenAI({ apiKey });

    // Test GPT-5.2 with reasoning and text parameters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.chat.completions.create as any)({
      model: 'gpt-5.2',
      max_tokens: 256,
      reasoning: {
        effort: 'medium',
      },
      text: {
        verbosity: 'medium',
      },
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Explain your reasoning briefly.',
        },
      ],
    });

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      model: 'gpt-5.2',
      parameters: {
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' },
      },
      response: {
        content: response.choices?.[0]?.message?.content,
        usage: response.usage,
        model: response.model,
      },
      elapsedMs: elapsed,
    });
  } catch (error) {
    console.error('OpenAI test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
}
