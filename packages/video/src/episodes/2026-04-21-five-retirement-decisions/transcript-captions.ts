import transcript from './transcript.json' assert { type: 'json' };

export interface CaptionSegment {
  fromFrame: number;
  durationFrames: number;
  text: string;
}

interface WordEntry {
  text: string;
  start: number;
  end: number;
  type: string;
}

// Known ASR errors → canonical spellings
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bArk Invest\b/g, 'ArcVest'],
  [/\bArk invest\b/g, 'ArcVest'],
  [/\bArk Investment\b/g, 'ArcVest'],
  [/\bArk\.?\s?Invest\b/g, 'ArcVest'],
  [/\bark\s?invest\b/gi, 'ArcVest'],
  [/\bFerguson\b/g, 'Fargason'],
  [/\bEric\b/g, 'Erik'],
  [/\bBingham\b/g, 'Bengen'],
  [/\bIrma\b/g, 'IRMAA'],
  [/\bIRMA\b/g, 'IRMAA'],
  [/\bshirp\s*plan\b/gi, 'sherpaplan'],
  [/\bshirplan\b/gi, 'sherpaplan'],
  [/\bsherpaplan\s*\.?\s*com\b/gi, 'sherpaplan.com'],
  [/\bshurp\s*plan\b/gi, 'sherpaplan'],
];

function fixTranscription(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function buildCaptions(fps: number): CaptionSegment[] {
  const words = transcript.words as WordEntry[];
  const segments: CaptionSegment[] = [];

  const MAX_DURATION_SEC = 3.2;
  const MAX_CHARS = 75;
  let buffer: WordEntry[] = [];
  let bufferText = '';

  const flush = (): void => {
    if (buffer.length === 0) return;
    const start = buffer[0].start;
    const end = buffer[buffer.length - 1].end;
    segments.push({
      fromFrame: Math.round(start * fps),
      durationFrames: Math.max(6, Math.round((end - start) * fps)),
      text: fixTranscription(bufferText.trim()),
    });
    buffer = [];
    bufferText = '';
  };

  for (const w of words) {
    if (w.type === 'spacing') {
      bufferText += w.text;
      continue;
    }
    buffer.push(w);
    bufferText += w.text;

    const candidateDuration = w.end - buffer[0].start;
    const endsWithPunct = /[.!?,]"?$/.test(w.text);
    const overLimit = candidateDuration >= MAX_DURATION_SEC || bufferText.length >= MAX_CHARS;
    if (endsWithPunct || overLimit) {
      flush();
    }
  }
  flush();
  return segments;
}
