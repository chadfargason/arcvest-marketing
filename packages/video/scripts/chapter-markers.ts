import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Generate YouTube chapter markers from an episode's slidePlan.
 * YouTube requires: first chapter at 0:00, minimum 3 chapters, minimum 10 seconds each.
 *
 * Usage: tsx scripts/chapter-markers.ts <episode-dir>
 * Writes <episode-dir>/youtube-chapters.txt
 */

interface Segment {
  startSec: number;
  endSec: number;
  kind: 'video' | 'slide';
  slide?: string;
  props?: {
    kicker?: string;
    title?: string;
    heading?: string;
    episodeTitle?: string;
  };
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const episodeDir = process.argv[2];
  if (!episodeDir) {
    console.error('Usage: tsx scripts/chapter-markers.ts <episode-dir>');
    process.exit(1);
  }

  const configPath = resolve(join(episodeDir, 'config.ts'));
  const mod = await import(pathToFileURL(configPath).href);
  const slidePlan: Segment[] = mod.slidePlan;

  // Chapter candidates: ChapterSlide, TitleSlide, major StatSlide transitions
  const chapters: Array<{ startSec: number; label: string }> = [];
  for (const seg of slidePlan) {
    if (seg.kind !== 'slide') continue;
    if (seg.slide === 'title') {
      chapters.push({ startSec: 0, label: 'Cold open' });
    }
    if (seg.slide === 'chapter') {
      const kicker = seg.props?.kicker ?? '';
      const title = seg.props?.title ?? '';
      chapters.push({ startSec: seg.startSec, label: `${kicker ? kicker + ': ' : ''}${title}` });
    }
  }

  if (chapters.length === 0 || chapters[0].startSec !== 0) {
    chapters.unshift({ startSec: 0, label: 'Intro' });
  }

  const lines = chapters.map((c) => `${mmss(c.startSec)} ${c.label}`);
  const outPath = join(episodeDir, 'youtube-chapters.txt');
  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`Wrote ${outPath}:`);
  for (const line of lines) console.log('  ' + line);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
