export interface Caption {
  fromFrame: number;
  durationFrames: number;
  text: string;
}

// 30fps, 6 scenes × 5s = 150 frames per scene, 900 frames total.
// Captions aligned to VO pacing within each scene.
export const captions: Caption[] = [
  // Scene 1 (0–150): Hook
  { fromFrame: 10, durationFrames: 70, text: 'Over a million dollars — gone.' },
  { fromFrame: 80, durationFrames: 65, text: 'To someone else. Not to you.' },

  // Scene 2 (150–300): Setup
  { fromFrame: 160, durationFrames: 70, text: 'Same $500,000 portfolio. Same 7% return.' },
  { fromFrame: 230, durationFrames: 65, text: '$25,000 added every year. Two advisors.' },

  // Scene 3 (300–450): The race
  { fromFrame: 310, durationFrames: 70, text: 'One charges 1.5% all-in.' },
  { fromFrame: 380, durationFrames: 65, text: 'ArcVest charges 0.5% all-in.' },

  // Scene 4 (450–600): Year 30 reveal
  { fromFrame: 460, durationFrames: 60, text: 'After 30 years,' },
  { fromFrame: 520, durationFrames: 75, text: 'one ends at $4.30M. The other at $5.47M.' },

  // Scene 5 (600–750): Gap
  { fromFrame: 610, durationFrames: 140, text: 'Over a million dollars — going to someone else. Not to you.' },

  // Scene 6 (750–900): CTA
  { fromFrame: 760, durationFrames: 140, text: 'See what a fiduciary fee looks like.' },
];
