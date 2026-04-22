export interface Caption {
  fromFrame: number;
  durationFrames: number;
  text: string;
}

// 30fps, 1800 frame total. Frames are absolute. Aligned to per-scene VO timings.
export const captions: Caption[] = [
  // Scene 1 — Hook (frames 0–180)
  { fromFrame: 30, durationFrames: 100, text: 'This is what a 1% fee costs you' },
  { fromFrame: 95, durationFrames: 80, text: '...over a lifetime' },

  // Scene 2 — Split-screen setup (frames 180–540)
  { fromFrame: 200, durationFrames: 110, text: 'Two investors. Same starting balance.' },
  { fromFrame: 315, durationFrames: 120, text: 'Same return. Same contributions.' },
  { fromFrame: 440, durationFrames: 95, text: 'Only the fees are different.' },

  // Scene 3 — Divergence (frames 540–1260)
  { fromFrame: 690, durationFrames: 140, text: 'Year 10 — barely a gap.' },
  { fromFrame: 870, durationFrames: 200, text: 'Year 20 — it starts to widen.' },
  { fromFrame: 1080, durationFrames: 180, text: 'Year 30 — $5.47M vs $4.30M' },

  // Scene 4 — Reveal (frames 1260–1620)
  { fromFrame: 1295, durationFrames: 145, text: '$1,170,000 — about 4 extra years of retirement' },
  { fromFrame: 1450, durationFrames: 165, text: 'Gone — to fees' },

  // Scene 5 — CTA (frames 1620–1800)
  { fromFrame: 1640, durationFrames: 145, text: 'See what a fiduciary fee looks like' },
];
