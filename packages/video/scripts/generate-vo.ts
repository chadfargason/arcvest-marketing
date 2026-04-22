import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SCRIPT_PATH = join(ROOT, 'src', 'fee-drag', 'script.txt');
const OUTPUT_PATH = join(ROOT, 'public', 'vo.mp3');
const VOICE_ID = '61kW7oMrRBiu4tK5QgOP'; // Chad Fargason clone
const MODEL_ID = 'eleven_turbo_v2_5';
const PRONUNCIATION_DICT_ID = 'jWwlxS9aX39dEcZGev01';
const PRONUNCIATION_VERSION_ID = 'v9C2pHW1bvzVAdPIcTKd';

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY is not set. See memory reference_elevenlabs.md for the key.');
    process.exit(1);
  }

  if (!existsSync(SCRIPT_PATH)) {
    console.error(`ERROR: Script not found at ${SCRIPT_PATH}`);
    process.exit(1);
  }

  const text = readFileSync(SCRIPT_PATH, 'utf8').trim();
  console.log(`Script: ${text.length} chars`);
  console.log(`Voice: Chad clone (${VOICE_ID}), model ${MODEL_ID}`);

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
    console.error(`ERROR: ElevenLabs API returned ${response.status}: ${errText}`);
    process.exit(1);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, audio);
  const sizeKB = (audio.length / 1024).toFixed(1);
  console.log(`OK — wrote ${OUTPUT_PATH} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
