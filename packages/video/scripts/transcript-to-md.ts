import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Convert ElevenLabs Scribe transcript.json to a human-readable transcript.md
 * with [mm:ss] timestamps at sentence boundaries (or every ~15 seconds).
 *
 * Usage: tsx scripts/transcript-to-md.ts <transcript.json> <transcript.md>
 */

interface WordEntry {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'spacing';
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function main(): void {
  const [jsonPath, mdPath] = process.argv.slice(2);
  if (!jsonPath || !mdPath) {
    console.error('Usage: tsx scripts/transcript-to-md.ts <input.json> <output.md>');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(jsonPath, 'utf8')) as { words: WordEntry[]; audio_duration_secs: number };
  const words = data.words;

  // Build sentences: group words until we hit a sentence-end punctuation, then start a new paragraph.
  interface Sentence {
    startSec: number;
    endSec: number;
    text: string;
  }

  const sentences: Sentence[] = [];
  let buffer = '';
  let sentenceStart: number | null = null;
  let lastEnd = 0;

  const FLUSH_AFTER_SEC = 15; // also flush if a sentence runs too long without punctuation

  for (const w of words) {
    if (sentenceStart === null && w.type === 'word') {
      sentenceStart = w.start;
    }
    buffer += w.text;
    lastEnd = w.end;
    const trimmed = buffer.trim();
    const endsWithPunct = /[.!?]"?$/.test(trimmed);
    const runOn = sentenceStart !== null && w.end - sentenceStart > FLUSH_AFTER_SEC;

    if ((endsWithPunct || runOn) && sentenceStart !== null) {
      sentences.push({ startSec: sentenceStart, endSec: lastEnd, text: trimmed });
      buffer = '';
      sentenceStart = null;
    }
  }
  if (buffer.trim() && sentenceStart !== null) {
    sentences.push({ startSec: sentenceStart, endSec: lastEnd, text: buffer.trim() });
  }

  // Emit markdown. One blank line between sentences; [mm:ss] prefix at the head of each.
  const out: string[] = [];
  out.push('# Podcast Transcript');
  out.push('');
  out.push(`Total duration: **${mmss(data.audio_duration_secs)}**  ·  Generated via ElevenLabs Scribe v1`);
  out.push('');
  out.push('---');
  out.push('');
  out.push('Markup guide: next to any sentence, add `<!-- SLIDE: <kind> -->` or `<!-- VIDEO -->` to set the visual at that moment. Kinds: `title`, `chapter`, `timeline`, `chart-dual`, `chart-scoreboard`, `stat`, `checklist`, `quote`, `concept`, `outro`. Add props with `<!-- PROPS: {...} -->` on the next line.');
  out.push('');
  out.push('---');
  out.push('');

  let lastHeaderMin = -1;
  for (const s of sentences) {
    const minute = Math.floor(s.startSec / 60);
    if (minute !== lastHeaderMin && minute % 2 === 0) {
      out.push('');
      out.push(`## ${mmss(minute * 60)}`);
      out.push('');
      lastHeaderMin = minute;
    }
    out.push(`[${mmss(s.startSec)}] ${s.text}`);
    out.push('');
  }

  writeFileSync(mdPath, out.join('\n'));
  console.log(`Wrote ${mdPath}  ·  ${sentences.length} sentences`);
}

main();
