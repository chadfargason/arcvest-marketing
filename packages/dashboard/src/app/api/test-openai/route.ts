import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// GET /api/test-openai - Test GPT-5.2 with Responses API
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

    // GPT-5.2 uses the Responses API, not Chat Completions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses as any).create({
      model: 'gpt-5.2',
      input: 'What is 2+2? Explain your reasoning briefly.',
      reasoning: {
        effort: 'medium',
      },
      text: {
        verbosity: 'medium',
      },
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
        output_text: response.output_text,
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
