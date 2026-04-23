import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * Transcribe an audio file via ElevenLabs Scribe v1 with word-level timestamps.
 *
 * Usage:
 *   tsx scripts/transcribe.ts <audio-path> <output-json-path>
 *
 * Env:
 *   ELEVENLABS_API_KEY must be set
 *
 * Output JSON schema (subset of ElevenLabs response we care about):
 *   {
 *     "text": "full transcript text",
 *     "language_code": "eng",
 *     "words": [
 *       { "text": "hello", "start": 0.12, "end": 0.48, "type": "word" },
 *       { "text": ",", "start": 0.48, "end": 0.55, "type": "spacing" },
 *       ...
 *     ]
 *   }
 */

const MODEL_ID = 'scribe_v1';

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY not set. See memory reference_elevenlabs.md.');
    process.exit(1);
  }

  const audioPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!audioPath || !outputPath) {
    console.error('Usage: tsx scripts/transcribe.ts <audio-path> <output-json-path>');
    process.exit(1);
  }
  if (!existsSync(audioPath)) {
    console.error(`ERROR: audio file not found: ${audioPath}`);
    process.exit(1);
  }

  const audioBytes = readFileSync(audioPath);
  const sizeMB = (audioBytes.length / (1024 * 1024)).toFixed(1);
  console.log(`Transcribing ${basename(audioPath)} (${sizeMB} MB) with ElevenLabs Scribe v1...`);
  console.log('This may take several minutes for a long file.');

  const form = new FormData();
  form.append('model_id', MODEL_ID);
  form.append('file', new Blob([new Uint8Array(audioBytes)], { type: 'audio/mpeg' }), basename(audioPath));
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');

  const startTs = Date.now();
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`ERROR: ElevenLabs Scribe API returned ${response.status}: ${errText}`);
    process.exit(1);
  }

  const result = (await response.json()) as {
    text: string;
    language_code: string;
    language_probability: number;
    words: Array<{
      text: string;
      start: number;
      end: number;
      type: 'word' | 'spacing' | 'audio_event';
      speaker_id?: string;
    }>;
  };

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2));

  const wordCount = result.words.filter((w) => w.type === 'word').length;
  const durationSec = result.words.length > 0 ? result.words[result.words.length - 1].end : 0;

  console.log(`\nOK — transcription complete in ${elapsed}s.`);
  console.log(`  Language: ${result.language_code} (confidence ${(result.language_probability * 100).toFixed(1)}%)`);
  console.log(`  Duration: ${Math.floor(durationSec / 60)}:${Math.floor(durationSec % 60).toString().padStart(2, '0')}`);
  console.log(`  Words:    ${wordCount}`);
  console.log(`  Output:   ${outputPath}`);
  const jsonSizeKB = (statSync(outputPath).size / 1024).toFixed(1);
  console.log(`  JSON:     ${jsonSizeKB} KB`);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message ?? err);
  process.exit(1);
});
