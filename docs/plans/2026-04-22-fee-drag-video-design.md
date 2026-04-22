# Fee Drag Video — Design Spec

**Date**: 2026-04-22
**Owner**: Chad Fargason
**Status**: Design approved, ready for implementation plan

## Goal

Produce a 30-second explainer video that shows the dollar impact of a 1% all-in fee difference over 30 years. First proof-of-concept for an ArcVest video content pipeline built on Remotion + ElevenLabs. Destined for YouTube (main channel) and paid social. CTA drives traffic to `arcvest.com/retirement-guide`.

## Scope

- One video. 16:9 (1920×1080) at 30fps, 30 seconds (900 frames).
- Voice: Chad's ElevenLabs cloned voice (podcast continuity).
- Tone: warm / educational.
- Silent-safe: full-text captions on every frame so it plays without audio (required for auto-play feeds).
- Data-driven: one config file holds all numbers; changing a number re-renders with new content.

Out of scope for v1: 9:16 vertical cut (decide after reviewing 16:9), VO emotion variants, thumbnail generation, automated publishing.

## Concept

Same $500K portfolio. Same 7% gross return. Same $25K/year contributions for 30 years. Two advisors with different all-in fees. The 1% fee gap grows into a $1.17M difference by year 30. The hook line: *"over a million dollars — going to someone else. Not to you."*

## Numbers (locked)

All figures produced from one formula and one config:

```
FV = P × (1 + r − f)^n + PMT × [((1 + r − f)^n − 1) / (r − f)]
```

| Input | Value |
|---|---|
| Starting balance (P) | $500,000 |
| Annual contribution (PMT), end of year | $25,000 |
| Gross return (r) | 7.0%, constant |
| Horizon (n) | 30 years |
| Advisor A fee (f_A) | 1.50% all-in = 1.0% advisory + 0.5% product |
| ArcVest fee (f_B) | 0.50% all-in = 0.4% advisory + 0.1% product |

Computed outputs:

| | Growth factor | Lump FV | Contrib FV | Total |
|---|---|---|---|---|
| Advisor A (5.5% net) | 4.9839 | $2,491,950 | $1,810,875 | **$4,302,825** |
| ArcVest (6.5% net) | 6.6144 | $3,307,200 | $2,159,375 | **$5,466,575** |
| **Gap** | | | | **$1,163,750 ≈ $1.17M** |

On-screen rounding rules: millions rounded to 2 decimals ($5.47M, $4.30M, $1.17M). Year-labeled balances on chart pulled from per-year computation, no rounding until render.

## Storyboard (6 scenes × 5s each, 30s total)

| # | Frames | Visual | On-screen text | VO |
|---|---|---|---|---|
| 1 | 0–150 | Black to dark background. Large number slams in with weight animation: **$1.17M**. | "$1.17 Million" | *"Over a million dollars — gone. To someone else. Not to you."* |
| 2 | 150–300 | Table animates in showing the fee breakdown. | Advisor A: 1.0% + 0.5% = 1.5% all-in / ArcVest: 0.4% + 0.1% = 0.5% all-in | *"Same $500,000 portfolio. Same 7% return. $25,000 added every year. Two advisors."* |
| 3 | 300–450 | Dual line chart builds year by year (year 1 → 30). Both lines share origin, diverge as years pass. | Chart axes: $ (y), Years (x). Legend: Advisor A (gray), ArcVest (ArcVest brand color). | *"One charges 1.5% all-in. ArcVest charges 0.5% all-in."* |
| 4 | 450–600 | Chart freezes at year 30. Two end-balance labels pop in at line ends. | "$4.30M" (Advisor A) / "$5.47M" (ArcVest) | *"After 30 years, one portfolio ends at 4.3 million. The other at 5.47 million."* |
| 5 | 600–750 | Gap between the two lines fills red. The difference number re-emerges as a callout. | "$1.17M DIFFERENCE" | *"That's over a million dollars — going to someone else. Not to you."* |
| 6 | 750–900 | ArcVest logo + CTA. Small print disclaimer. | CTA: "arcvest.com/retirement-guide" / Disclaimer: "Hypothetical illustration. 7% assumed gross annual return, constant. Not a forecast or guarantee. Past performance does not guarantee future results. All-in fees include advisory plus weighted product expense ratios. Competitor figures are industry-typical, not specific to any firm." | *"See what a fiduciary fee looks like. arcvest dot com slash retirement guide."* |

Captions on-screen throughout — fiduciary-aligned language only (no "guaranteed", no "will", no predictions). "Assumed" and "hypothetical" are used explicitly.

## VO script (final, ~85 words, ~28s at moderate pace)

```
Over a million dollars — gone. To someone else. Not to you.

Same $500,000 portfolio. Same 7% return. $25,000 added every year. Two advisors.

One charges 1.5% all-in. ArcVest charges 0.5% all-in.

After 30 years, one portfolio ends at 4.3 million. The other at 5.47 million.

That's over a million dollars — going to someone else. Not to you.

See what a fiduciary fee looks like. arcvest dot com slash retirement guide.
```

## Technical stack

**New package**: `arcvest-marketing/packages/video`

Dependencies:
- `remotion` + `@remotion/cli` + `@remotion/bundler` + `@remotion/renderer` — video composition and rendering
- `@remotion/captions` — caption timing
- `react` + `react-dom` — Remotion requires them
- TypeScript (matches rest of monorepo)

No runtime service or API endpoint. This is a build-time content generator.

### Package layout

```
packages/video/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── src/
│   ├── Root.tsx                         # Remotion root, registers compositions
│   ├── fee-drag/
│   │   ├── FeeDragVideo.tsx             # Top-level composition
│   │   ├── scenes/
│   │   │   ├── 01-HookNumber.tsx
│   │   │   ├── 02-FeeBreakdown.tsx
│   │   │   ├── 03-DualLineChart.tsx
│   │   │   ├── 04-YearThirtyReveal.tsx
│   │   │   ├── 05-GapCallout.tsx
│   │   │   └── 06-CTA.tsx
│   │   ├── config.ts                    # P, PMT, r, f_A, f_B, n, colors, brand
│   │   ├── compute.ts                   # pure math: yearly balances, FVs, gap
│   │   ├── captions.ts                  # caption timing array (frame offsets)
│   │   └── script.txt                   # VO text (source for ElevenLabs)
│   └── brand/
│       ├── colors.ts                    # ArcVest palette (pulled from arcvest-site)
│       └── fonts.ts                     # Inter / SF Pro stack
├── scripts/
│   └── generate-vo.ts                   # ElevenLabs API → public/vo.mp3
├── public/
│   └── vo.mp3                           # generated, gitignored
└── out/
    └── fee-drag-30s-16x9.mp4            # rendered output, gitignored
```

### npm scripts (at package root)

| Script | Action |
|---|---|
| `npm run video:vo` | Regenerate VO via ElevenLabs from `script.txt` → `public/vo.mp3` |
| `npm run video:preview` | Start Remotion Studio (live preview, scrubbable) |
| `npm run video:render` | Render `fee-drag-30s-16x9.mp4` to `out/` |
| `npm run video:build` | vo + render in sequence |

### ElevenLabs integration (generate-vo.ts)

Uses creds from memory `reference_elevenlabs.md`:
- API key from `ELEVENLABS_API_KEY` env var (to be added to `.env.local` and Vercel if needed for CI)
- Voice ID: `61kW7oMrRBiu4tK5QgOP` (Chad clone)
- Model: `eleven_turbo_v2_5`
- Voice settings: `{ style: 0.10, stability: 0.40, similarity_boost: 0.75, use_speaker_boost: true }`
- Pronunciation dictionary attached (won't affect this script, but keeps parity with podcast pipeline for future scripts that mention IRMAA, MAGI, FICA, etc.)

### Data flow

1. `config.ts` holds assumptions as typed constants.
2. `compute.ts` exports `computeYearlyBalances(config)` → `{ years: number[]; advA: number[]; advB: number[]; endA: number; endB: number; gap: number }`. Pure function, unit-testable.
3. Scene components receive `frame` from Remotion hooks, read `config` and computed balances, animate via `interpolate()` and `spring()`.
4. Chart scene uses inline SVG (no chart lib — avoids font/sizing drift in render).
5. Audio: `<Audio src={staticFile('vo.mp3')} />` at composition root, starts at frame 0.
6. Captions: frame-offset array in `captions.ts`, rendered via `<Sequence>` blocks, word-level highlighting optional in v2.

### Why no chart library

Remotion renders headless Chrome frame-by-frame. Chart libraries (recharts, chart.js) pull fonts and do async measurements that cause non-determinism across frames. A hand-rolled SVG chart with absolute positioning is deterministic, faster, and gives exact visual control.

## Visual style

- **Background**: near-black (`#0A0E14`), slight vignette. Looks like financial TV, not a cheesy ad.
- **Primary accent**: ArcVest brand color (TBD pulled from arcvest-site; default placeholder `#2563EB`).
- **Advisor A color**: muted gray `#6B7280`.
- **Gap color**: deep red `#DC2626` at 40% opacity fill.
- **Font**: Inter (or SF Pro fallback). All caps headlines, tabular numerals for dollar figures.
- **Motion**: 250–400ms spring-eases. No lens flares, no particles, no camera pans. Minimalist data-viz.

## Compliance

Mandatory on-screen elements:
- Frame 6 disclaimer text: included in full above.
- The word "hypothetical" or "assumed" present whenever a rate/return is shown.
- No word "guarantee", "will", "projected return", "certain", or similar predictive language.
- CTA URL is ArcVest-owned.

Language review: passes ContentAgent system prompt (no predictions, no guarantees, educational). Subject to your final compliance sign-off before publish.

## Deliverables

- `out/fee-drag-30s-16x9.mp4` — rendered video, ~4–8 MB at 1080p H.264
- Source available for edits — re-running render with different `config.ts` values yields a new video
- Unit test for `compute.ts` verifying $5.47M / $4.30M / $1.17M (to prevent silent regressions)

## Open items (not blocking the plan)

1. Exact ArcVest brand hex — pull from arcvest-site during implementation
2. Whether to add ElevenLabs key to Vercel env (not needed for v1 since rendering is local; deferred)
3. Publishing path — YouTube upload automation out of scope for this spec

## Non-goals (explicitly deferred)

- Automated YouTube/Meta publishing
- Multiple aspect ratios (9:16, 1:1)
- A/B test variants with different fee numbers
- Animated captions with word-level highlight
- Motion tests on mobile device preview
