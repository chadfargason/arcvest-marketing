import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TIMING = join(__dirname, '..', 'public', 'timing');

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

function findPhrase(a: Alignment, phrase: string): { start: number; end: number } | null {
  const chars = a.characters;
  const text = chars.join('');
  const lower = text.toLowerCase();
  const idx = lower.indexOf(phrase.toLowerCase());
  if (idx < 0) return null;
  return {
    start: a.character_start_times_seconds[idx],
    end: a.character_end_times_seconds[idx + phrase.length - 1],
  };
}

function dumpFile(file: string, phrases: string[]): void {
  const a: Alignment = JSON.parse(readFileSync(join(TIMING, file), 'utf8'));
  const totalDur = a.character_end_times_seconds.at(-1) ?? 0;
  console.log(`\n${file}  (total ${totalDur.toFixed(2)}s, ${a.characters.length} chars)`);
  console.log(`  full text: "${a.characters.join('').slice(0, 90)}${a.characters.length > 90 ? '...' : ''}"`);
  for (const phrase of phrases) {
    const t = findPhrase(a, phrase);
    if (t) {
      console.log(`  "${phrase}"   start=${t.start.toFixed(3)}s   end=${t.end.toFixed(3)}s`);
    } else {
      console.log(`  "${phrase}"   NOT FOUND`);
    }
  }
}

dumpFile('vo-1-hook.json', ['one million']);
dumpFile('vo-2-setup.json', ['half a million', 'seven percent', 'twenty-five thousand', 'one-point-five', 'point-five percent']);
dumpFile('vo-3-divergence.json', ['year ten', 'year twenty', 'year thirty', 'five-point-four-seven', 'four-point-three']);
dumpFile('vo-4-reveal.json', ['one-point-one-seven', 'four percent rule', 'beach house']);
dumpFile('vo-5-cta.json', ['arcvest dot com', 'pay less, keep more']);
