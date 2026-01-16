/**
 * Phrase Variations API
 * POST /api/creative/phrase-variations
 *
 * Generates variations of a seed phrase for ad copy.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Lazy initialization
let supabase: SupabaseClient | null = null;
let anthropic: Anthropic | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!url || !key) throw new Error('Missing Supabase credentials');
    supabase = createClient(url, key);
  }
  return supabase;
}

function getAnthropic(): Anthropic {
  if (!anthropic) {
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
    anthropic = new Anthropic({ apiKey: key });
  }
  return anthropic;
}

function hashPhrase(phrase: string): string {
  return crypto.createHash('md5').update(phrase.toLowerCase().trim()).digest('hex');
}

interface RequestBody {
  seedPhrase: string;
  count?: number;
  style?: 'varied' | 'similar' | 'contrasting';
  maxLength?: number;
}

interface Variation {
  id?: string;
  text: string;
  variationNumber: number;
  rating?: number;
  isNew?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { seedPhrase, count = 10, style = 'varied', maxLength } = body;

    if (!seedPhrase || seedPhrase.trim().length === 0) {
      return NextResponse.json(
        { error: 'Seed phrase is required' },
        { status: 400 }
      );
    }

    const seedHash = hashPhrase(seedPhrase);

    // Fetch rejected phrases to exclude
    const { data: rejectedPhrases } = await getSupabase()
      .from('rejected_phrases')
      .select('phrase');

    const rejectedList = rejectedPhrases?.map(r => r.phrase) || [];

    // Check if we already have variations for this seed
    const { data: existingVariations } = await getSupabase()
      .from('phrase_variations')
      .select('*')
      .eq('seed_phrase_hash', seedHash)
      .eq('is_rejected', false)
      .order('variation_number', { ascending: true });

    // Generate new variations with Claude
    const prompt = buildPrompt(seedPhrase, count, style, maxLength, rejectedList);

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.9,
      system: `You are an expert advertising copywriter specializing in financial services marketing.
Your task is to create compelling variations of marketing phrases that:
- Maintain the core message and value proposition
- Are compliant with SEC Marketing Rule (no guarantees, no performance promises)
- Appeal to sophisticated investors and retirement planners
- Are punchy, memorable, and action-oriented
- Stay within any specified character limits

IMPORTANT: Avoid these patterns that have been rejected before:
${rejectedList.length > 0 ? rejectedList.map(p => `- "${p}"`).join('\n') : '(none)'}`,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    // Parse variations from response
    const generatedVariations = parseVariations(textContent.text);

    // Calculate starting variation number (after existing ones)
    const startNumber = existingVariations?.length || 0;

    // Save new variations to database
    const newVariations: Variation[] = [];
    for (let i = 0; i < generatedVariations.length; i++) {
      const variationText = generatedVariations[i];

      // Skip if this exact text already exists
      if (existingVariations?.some(v => v.variation_text === variationText)) {
        continue;
      }

      const { data: inserted, error } = await getSupabase()
        .from('phrase_variations')
        .insert({
          seed_phrase: seedPhrase.trim(),
          seed_phrase_hash: seedHash,
          variation_text: variationText,
          variation_number: startNumber + i + 1,
          generation_config: { style, maxLength },
        })
        .select()
        .single();

      if (!error && inserted) {
        newVariations.push({
          id: inserted.id,
          text: inserted.variation_text,
          variationNumber: inserted.variation_number,
          rating: inserted.rating,
          isNew: true,
        });
      }
    }

    // Combine existing and new variations
    const allVariations: Variation[] = [
      ...(existingVariations?.map(v => ({
        id: v.id,
        text: v.variation_text,
        variationNumber: v.variation_number,
        rating: v.rating,
        isNew: false,
      })) || []),
      ...newVariations,
    ];

    return NextResponse.json({
      success: true,
      seedPhrase: seedPhrase.trim(),
      variations: allVariations,
      stats: {
        existing: existingVariations?.length || 0,
        newGenerated: newVariations.length,
        total: allVariations.length,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('[PhraseVariations] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildPrompt(
  seedPhrase: string,
  count: number,
  style: string,
  maxLength?: number,
  _rejectedList?: string[]
): string {
  const styleInstructions = {
    varied: 'Create diverse variations with different angles, tones, and structures. Some should be questions, some statements, some with numbers.',
    similar: 'Create variations that stay close to the original tone and structure, with subtle wording changes.',
    contrasting: 'Create variations that take different angles or approaches while keeping the core message.',
  };

  return `Generate ${count} compelling variations of this marketing phrase:

"${seedPhrase}"

Style: ${styleInstructions[style as keyof typeof styleInstructions] || styleInstructions.varied}
${maxLength ? `Maximum length: ${maxLength} characters per variation` : ''}

Requirements:
- Each variation should be a complete, standalone phrase
- Maintain the core value proposition
- Be creative but stay appropriate for a wealth management firm
- No guarantees of returns or performance
- Mix of approaches: some with numbers, some as questions, some direct statements

Output format: Return ONLY a numbered list with one variation per line, like:
1. Variation text here
2. Another variation here
...`;
}

function parseVariations(text: string): string[] {
  const lines = text.split('\n');
  const variations: string[] = [];

  for (const line of lines) {
    // Match numbered lines: "1. Text" or "1) Text"
    const match = line.match(/^\d+[.)]\s*(.+)$/);
    if (match && match[1]) {
      const variation = match[1].trim();
      // Remove quotes if present
      const cleaned = variation.replace(/^["']|["']$/g, '').trim();
      if (cleaned.length > 0) {
        variations.push(cleaned);
      }
    }
  }

  return variations;
}

/**
 * GET endpoint - fetch existing variations for a seed phrase
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seedPhrase = searchParams.get('seedPhrase');

    if (!seedPhrase) {
      // Return all recent variations grouped by seed
      const { data, error } = await getSupabase()
        .from('phrase_variations')
        .select('*')
        .eq('is_rejected', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by seed phrase
      const grouped: Record<string, Variation[]> = {};
      for (const v of data || []) {
        if (!grouped[v.seed_phrase]) {
          grouped[v.seed_phrase] = [];
        }
        grouped[v.seed_phrase].push({
          id: v.id,
          text: v.variation_text,
          variationNumber: v.variation_number,
          rating: v.rating,
        });
      }

      return NextResponse.json({
        success: true,
        seeds: Object.keys(grouped).map(seed => ({
          seedPhrase: seed,
          variations: grouped[seed],
        })),
      });
    }

    const seedHash = hashPhrase(seedPhrase);
    const { data, error } = await getSupabase()
      .from('phrase_variations')
      .select('*')
      .eq('seed_phrase_hash', seedHash)
      .eq('is_rejected', false)
      .order('variation_number', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      seedPhrase,
      variations: data?.map(v => ({
        id: v.id,
        text: v.variation_text,
        variationNumber: v.variation_number,
        rating: v.rating,
      })) || [],
    });
  } catch (error) {
    console.error('[PhraseVariations] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
