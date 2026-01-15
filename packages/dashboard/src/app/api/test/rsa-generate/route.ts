/**
 * Test endpoint for RSA generation
 * POST /api/test/rsa-generate
 *
 * Generates RSA ads for specified persona/voice combinations.
 * This is a test endpoint that bypasses auth for development.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateRSABatch,
  getAllPersonaIds,
  getAllVoiceIds,
  getPersonaById,
  getVoiceById,
  type RSAGenerationResult,
} from '@arcvest/agents';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url || !key) {
      throw new Error(`Missing Supabase credentials: url=${!!url}, key=${!!key}`);
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

interface RequestBody {
  personaIds?: string[];
  voiceIds?: string[];
  variationsPerCombo?: number;
  saveToDatabase?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    // Default to a single persona/voice for testing
    const personaIds = body.personaIds || ['pre-retiree'];
    const voiceIds = body.voiceIds || ['direct'];
    const variationsPerCombo = body.variationsPerCombo || 10;
    const saveToDatabase = body.saveToDatabase ?? true;

    // Validate persona IDs
    const validPersonaIds = getAllPersonaIds();
    for (const id of personaIds) {
      if (!validPersonaIds.includes(id)) {
        return NextResponse.json(
          { error: `Invalid persona ID: ${id}. Valid IDs: ${validPersonaIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate voice IDs
    const validVoiceIds = getAllVoiceIds();
    for (const id of voiceIds) {
      if (!validVoiceIds.includes(id)) {
        return NextResponse.json(
          { error: `Invalid voice ID: ${id}. Valid IDs: ${validVoiceIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    console.log(`[RSA Test] Generating for ${personaIds.length} personas x ${voiceIds.length} voices...`);

    // Generate RSAs
    const batchResult = await generateRSABatch({
      personaIds,
      voiceIds,
      variationsPerCombo,
    });

    // Save to database if requested
    let savedRecords: { assetGroups: number; assets: number } = { assetGroups: 0, assets: 0 };
    if (saveToDatabase && batchResult.results.length > 0) {
      savedRecords = await saveResultsToDatabase(batchResult.results);
    }

    return NextResponse.json({
      success: true,
      summary: {
        ...batchResult.summary,
        savedToDatabase: saveToDatabase,
        savedRecords,
      },
      results: batchResult.results.map(r => ({
        personaId: r.metadata.personaId,
        voiceId: r.metadata.voiceId,
        personaName: getPersonaById(r.metadata.personaId)?.displayName,
        voiceName: getVoiceById(r.metadata.voiceId)?.displayName,
        master: {
          headlines: r.master.headlines.map(h => ({
            text: h.text,
            type: h.type,
            charCount: h.text.length,
          })),
          descriptions: r.master.descriptions.map(d => ({
            text: d.text,
            charCount: d.text.length,
          })),
        },
        variationCount: r.variations.length,
        compliancePassed: r.complianceResult.passed,
        complianceIssues: r.complianceResult.issues,
        processingTimeMs: r.metadata.processingTimeMs,
        tokensUsed: r.metadata.totalTokensUsed,
      })),
    });
  } catch (error) {
    console.error('[RSA Test] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Save generation results to the database
 */
async function saveResultsToDatabase(
  results: RSAGenerationResult[]
): Promise<{ assetGroups: number; assets: number }> {
  let assetGroupsCreated = 0;
  let assetsCreated = 0;

  for (const result of results) {
    const persona = getPersonaById(result.metadata.personaId);
    const voice = getVoiceById(result.metadata.voiceId);

    // Create master creative asset
    const { data: masterAsset, error: masterError } = await getSupabase()
      .from('creative_assets')
      .insert({
        name: `RSA: ${persona?.displayName} - ${voice?.displayName}`,
        asset_type: 'rsa',
        status: result.complianceResult.passed ? 'pending_approval' : 'draft',
        content: {
          headlines: result.master.headlines,
          descriptions: result.master.descriptions,
        },
        persona_id: result.metadata.personaId,
        voice_id: result.metadata.voiceId,
        variation_type: 'master',
        generation_method: 'multi_ai_pipeline',
        compliance_passed: result.complianceResult.passed,
        compliance_issues: result.complianceResult.issues.map(i => i.text),
      })
      .select()
      .single();

    if (masterError) {
      console.error('[RSA Test] Failed to save master asset:', masterError);
      continue;
    }

    assetsCreated++;

    // Create RSA asset group
    const { error: groupError } = await getSupabase()
      .from('rsa_asset_groups')
      .insert({
        name: `${persona?.displayName} - ${voice?.displayName}`,
        persona_id: result.metadata.personaId,
        voice_id: result.metadata.voiceId,
        master_asset_id: masterAsset.id,
        status: result.complianceResult.passed ? 'pending_review' : 'draft',
        generation_config: {
          variationsRequested: result.variations.length,
          processingTimeMs: result.metadata.processingTimeMs,
          tokensUsed: result.metadata.totalTokensUsed,
        },
        total_variations: result.variations.length,
        last_generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (groupError) {
      console.error('[RSA Test] Failed to save asset group:', groupError);
      continue;
    }

    assetGroupsCreated++;

    // Save individual headlines for the master
    const headlineInserts = result.master.headlines.map((h, i) => ({
      asset_id: masterAsset.id,
      position: i + 1,
      text: h.text,
      character_count: h.text.length,
      headline_type: h.type,
      pin_position: h.pinPosition || null,
    }));

    const { error: headlinesError } = await getSupabase()
      .from('rsa_headlines')
      .insert(headlineInserts);

    if (headlinesError) {
      console.error('[RSA Test] Failed to save headlines:', headlinesError);
    }

    // Save individual descriptions for the master
    const descInserts = result.master.descriptions.map((d, i) => ({
      asset_id: masterAsset.id,
      position: i + 1,
      text: d.text,
      character_count: d.text.length,
      pin_position: d.pinPosition || null,
    }));

    const { error: descsError } = await getSupabase()
      .from('rsa_descriptions')
      .insert(descInserts);

    if (descsError) {
      console.error('[RSA Test] Failed to save descriptions:', descsError);
    }

    // Save variations
    for (let i = 0; i < result.variations.length; i++) {
      const variation = result.variations[i];

      const { data: varAsset, error: varError } = await getSupabase()
        .from('creative_assets')
        .insert({
          name: `RSA Variation ${i + 1}: ${persona?.displayName} - ${voice?.displayName}`,
          asset_type: 'rsa',
          status: 'draft',
          content: {
            headlines: variation.headlines,
            descriptions: variation.descriptions,
          },
          persona_id: result.metadata.personaId,
          voice_id: result.metadata.voiceId,
          parent_asset_id: masterAsset.id,
          variation_number: i + 1,
          variation_type: 'variation',
          generation_method: 'variation',
          compliance_passed: true, // Variations are pre-validated
        })
        .select()
        .single();

      if (varError) {
        console.error(`[RSA Test] Failed to save variation ${i + 1}:`, varError);
        continue;
      }

      assetsCreated++;

      // Save variation headlines
      const varHeadlineInserts = variation.headlines.map((h, j) => ({
        asset_id: varAsset.id,
        position: j + 1,
        text: h.text,
        character_count: h.text.length,
        headline_type: h.type,
      }));

      await getSupabase().from('rsa_headlines').insert(varHeadlineInserts);

      // Save variation descriptions
      const varDescInserts = variation.descriptions.map((d, j) => ({
        asset_id: varAsset.id,
        position: j + 1,
        text: d.text,
        character_count: d.text.length,
      }));

      await getSupabase().from('rsa_descriptions').insert(varDescInserts);
    }
  }

  return { assetGroups: assetGroupsCreated, assets: assetsCreated };
}

/**
 * GET endpoint - returns available personas and voices
 */
export async function GET() {
  return NextResponse.json({
    availablePersonas: getAllPersonaIds().map(id => ({
      id,
      ...getPersonaById(id),
    })),
    availableVoices: getAllVoiceIds().map(id => ({
      id,
      ...getVoiceById(id),
    })),
    usage: {
      method: 'POST',
      body: {
        personaIds: ['pre-retiree', 'hnw-investor'],
        voiceIds: ['direct', 'educational'],
        variationsPerCombo: 10,
        saveToDatabase: true,
      },
    },
  });
}
