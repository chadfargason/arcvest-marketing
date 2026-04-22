import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SCRIPTS_DIR = join(ROOT, 'src', 'fee-drag', 'scripts');
const OUTPUT_DIR = join(ROOT, 'public');
const VOICE_ID = '61kW7oMrRBiu4tK5QgOP'; // Chad Fargason clone
const MODEL_ID = 'eleven_turbo_v2_5';
const PRONUNCIATION_DICT_ID = 'jWwlxS9aX39dEcZGev01';
const PRONUNCIATION_VERSION_ID = 'v9C2pHW1bvzVAdPIcTKd';

async function generateOne(scriptPath: string, outPath: string, apiKey: string): Promise<void> {
  const text = readFileSync(scriptPath, 'utf8').trim();
  if (!text) {
    console.log(`Skip ${basename(scriptPath)}: empty`);
    return;
  }
  console.log(`  ${basename(scriptPath)}: ${text.length} chars → ${basename(outPath)}`);

  const body = JSON.stringify({
    text,
    model_id: MODEL_ID,
    voice_settings: {
      style: 0.10,
      stability: 0.40,
      similarity_boost: 0.75,
      use_speaker_boost: true,
    },
    pronunciation_dictionary_locators: [
      { pronunciation_dictionary_id: PRONUNCIATION_DICT_ID, version_id: PRONUNCIATION_VERSION_ID },
    ],
  });

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API ${response.status} for ${basename(scriptPath)}: ${errText}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  writeFileSync(outPath, audio);
  const sizeKB = (audio.length / 1024).toFixed(1);
  console.log(`    OK (${sizeKB} KB)`);
}

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY is not set. See memory reference_elevenlabs.md.');
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const scripts = readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  if (scripts.length === 0) {
    console.error(`ERROR: No script files found in ${SCRIPTS_DIR}`);
    process.exit(1);
  }

  console.log(`Voice: Chad clone (${VOICE_ID}), model ${MODEL_ID}`);
  console.log(`Generating ${scripts.length} VO segments:\n`);

  for (const script of scripts) {
    const stem = basename(script, extname(script));
    const outPath = join(OUTPUT_DIR, `vo-${stem}.mp3`);
    await generateOne(join(SCRIPTS_DIR, script), outPath, apiKey);
  }

  console.log(`\nDone. Outputs in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message ?? err);
  process.exit(1);
});
