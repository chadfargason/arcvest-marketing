# Fee Drag Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `@arcvest/video` package that produces a 30-second fee-drag explainer MP4 (1080p 16:9) via Remotion, with ElevenLabs voiceover from Chad's cloned voice.

**Architecture:** New Turborepo package. Pure math compute module (TDD). Six scene components composed via Remotion `<Sequence>`. ElevenLabs API call as a pre-render step, VO mixed in as `<Audio>`. Deterministic SVG chart (no chart library) for frame-by-frame render stability.

**Tech Stack:** Remotion 4.x, React 18, TypeScript 5, Vitest, ElevenLabs REST API, tsx.

**Reference:** [`2026-04-22-fee-drag-video-design.md`](./2026-04-22-fee-drag-video-design.md) — design spec with all numbers, storyboard, VO script, and compliance rules. Read it first.

---

## File Structure

**Created:**
```
packages/video/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── vitest.config.ts
├── .gitignore
├── scripts/
│   └── generate-vo.ts                     # ElevenLabs VO generator
├── src/
│   ├── Root.tsx                           # Remotion compositions registry
│   ├── brand/
│   │   ├── colors.ts
│   │   └── fonts.ts
│   └── fee-drag/
│       ├── config.ts                      # Assumption constants
│       ├── compute.ts                     # Pure math
│       ├── compute.test.ts                # TDD for compute
│       ├── captions.ts                    # Caption timing array
│       ├── script.txt                     # VO source text
│       ├── FeeDragVideo.tsx               # Top composition
│       └── scenes/
│           ├── 01-HookNumber.tsx
│           ├── 02-FeeBreakdown.tsx
│           ├── 03-DualLineChart.tsx
│           ├── 04-YearThirtyReveal.tsx
│           ├── 05-GapCallout.tsx
│           └── 06-CTA.tsx
├── public/                                # Remotion static assets
│   └── (vo.mp3 generated, gitignored)
└── out/                                   # Render output, gitignored
```

**Modified:**
- `package.json` (root) — add `video:*` script shortcuts
- `.env.example` — add `ELEVENLABS_API_KEY`

**No changes** to `turbo.json` (video is build-time-only; not part of the deploy pipeline).

---

## Task 1: Scaffold `@arcvest/video` package

**Files:**
- Create: `packages/video/package.json`
- Create: `packages/video/tsconfig.json`
- Create: `packages/video/.gitignore`
- Create: `packages/video/src/Root.tsx` (stub)

- [ ] **Step 1: Create `packages/video/package.json`**

```json
{
  "name": "@arcvest/video",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "vo": "tsx scripts/generate-vo.ts",
    "preview": "remotion studio src/Root.tsx",
    "render": "remotion render src/Root.tsx FeeDrag out/fee-drag-30s-16x9.mp4",
    "build": "npm run vo && npm run render",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "echo 'Lint: @arcvest/video (no eslint configured)'"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.250",
    "@remotion/cli": "^4.0.250",
    "@remotion/bundler": "^4.0.250",
    "@remotion/renderer": "^4.0.250"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `packages/video/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "lib": ["ES2022", "DOM"],
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "scripts/**/*", "remotion.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `packages/video/.gitignore`**

```
node_modules/
out/
public/vo.mp3
.turbo/
```

- [ ] **Step 4: Create stub `packages/video/src/Root.tsx` so tooling installs cleanly**

```tsx
import { registerRoot } from 'remotion';

const RemotionRoot: React.FC = () => {
  return null;
};

registerRoot(RemotionRoot);
```

- [ ] **Step 5: Install deps from monorepo root**

Run: `cd /c/code/arcvest-marketing && npm install`
Expected: workspaces detect new package, install completes without errors. If Remotion warns about a missing `jsx` runtime, verify `tsconfig.json` has `"jsx": "react-jsx"`.

- [ ] **Step 6: Commit**

```bash
git add packages/video/package.json packages/video/tsconfig.json packages/video/.gitignore packages/video/src/Root.tsx package-lock.json
git commit -m "feat(video): scaffold @arcvest/video package for Remotion-based video generation"
```

---

## Task 2: Brand constants

**Files:**
- Create: `packages/video/src/brand/colors.ts`
- Create: `packages/video/src/brand/fonts.ts`

- [ ] **Step 1: Create `packages/video/src/brand/colors.ts`**

```ts
export const colors = {
  bg: '#0A0E14',
  bgVignette: '#000000',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  arcvest: '#2563EB',
  advisorA: '#6B7280',
  gap: '#DC2626',
  gapFill: 'rgba(220, 38, 38, 0.4)',
  gridLine: 'rgba(255, 255, 255, 0.08)',
} as const;
```

- [ ] **Step 2: Create `packages/video/src/brand/fonts.ts`**

```ts
export const fonts = {
  sans: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  tabular: "'Inter', 'SF Pro Display', -apple-system, monospace",
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add packages/video/src/brand/
git commit -m "feat(video): brand tokens — ArcVest colors and Inter font stack"
```

---

## Task 3: Config with locked assumptions

**Files:**
- Create: `packages/video/src/fee-drag/config.ts`

- [ ] **Step 1: Create `packages/video/src/fee-drag/config.ts`**

```ts
export const feeDragConfig = {
  startingBalance: 500_000,
  annualContribution: 25_000,
  grossReturn: 0.07,
  horizonYears: 30,
  advisorA: {
    label: 'Advisor A',
    advisoryFee: 0.010,
    productCost: 0.005,
    totalFee: 0.015,
  },
  advisorB: {
    label: 'ArcVest',
    advisoryFee: 0.004,
    productCost: 0.001,
    totalFee: 0.005,
  },
  video: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 30,
    durationFrames: 900,
  },
  cta: {
    url: 'arcvest.com/retirement-guide',
    displayUrl: 'arcvest.com/retirement-guide',
  },
  disclaimer:
    'Hypothetical illustration. 7% assumed gross annual return, constant. Not a forecast or guarantee. Past performance does not guarantee future results. All-in fees include advisory plus weighted product expense ratios. Competitor figures are industry-typical, not specific to any firm.',
} as const;

export type FeeDragConfig = typeof feeDragConfig;
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/config.ts
git commit -m "feat(video): locked assumptions for fee-drag video — \$500K / 7% / 30y"
```

---

## Task 4: Compute module (TDD)

**Files:**
- Create: `packages/video/src/fee-drag/compute.test.ts`
- Create: `packages/video/src/fee-drag/compute.ts`
- Create: `packages/video/vitest.config.ts`

- [ ] **Step 1: Create `packages/video/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write failing test `packages/video/src/fee-drag/compute.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeYearlyBalances } from './compute';
import { feeDragConfig } from './config';

describe('computeYearlyBalances', () => {
  const result = computeYearlyBalances(feeDragConfig);

  it('returns 31 years of balances (year 0 through year 30)', () => {
    expect(result.years).toHaveLength(31);
    expect(result.advA).toHaveLength(31);
    expect(result.advB).toHaveLength(31);
    expect(result.years[0]).toBe(0);
    expect(result.years[30]).toBe(30);
  });

  it('starts both lines at the starting balance', () => {
    expect(result.advA[0]).toBe(500_000);
    expect(result.advB[0]).toBe(500_000);
  });

  it('Advisor A ends within $500 of $4,302,825', () => {
    expect(result.endA).toBeGreaterThan(4_302_325);
    expect(result.endA).toBeLessThan(4_303_325);
  });

  it('ArcVest ends within $500 of $5,466,575', () => {
    expect(result.endB).toBeGreaterThan(5_466_075);
    expect(result.endB).toBeLessThan(5_467_075);
  });

  it('gap is within $500 of $1,163,750', () => {
    expect(result.gap).toBeGreaterThan(1_163_250);
    expect(result.gap).toBeLessThan(1_164_250);
  });

  it('ArcVest always beats Advisor A after year 0', () => {
    for (let i = 1; i < result.years.length; i++) {
      expect(result.advB[i]).toBeGreaterThan(result.advA[i]);
    }
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `cd packages/video && npm run test`
Expected: FAIL with "Cannot find module './compute'"

- [ ] **Step 4: Implement `packages/video/src/fee-drag/compute.ts`**

```ts
import type { FeeDragConfig } from './config';

export interface YearlyBalances {
  years: number[];
  advA: number[];
  advB: number[];
  endA: number;
  endB: number;
  gap: number;
}

export function computeYearlyBalances(cfg: FeeDragConfig): YearlyBalances {
  const { startingBalance: P, annualContribution: PMT, grossReturn: r, horizonYears: n } = cfg;
  const netA = r - cfg.advisorA.totalFee;
  const netB = r - cfg.advisorB.totalFee;

  const years: number[] = [];
  const advA: number[] = [];
  const advB: number[] = [];

  let balA = P;
  let balB = P;

  for (let year = 0; year <= n; year++) {
    years.push(year);
    advA.push(balA);
    advB.push(balB);
    if (year < n) {
      balA = balA * (1 + netA) + PMT;
      balB = balB * (1 + netB) + PMT;
    }
  }

  const endA = advA[advA.length - 1];
  const endB = advB[advB.length - 1];
  return { years, advA, advB, endA, endB, gap: endB - endA };
}

export function formatMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
```

- [ ] **Step 5: Run test — expect PASS**

Run: `cd packages/video && npm run test`
Expected: All 6 assertions pass.

- [ ] **Step 6: Commit**

```bash
git add packages/video/src/fee-drag/compute.ts packages/video/src/fee-drag/compute.test.ts packages/video/vitest.config.ts
git commit -m "feat(video): compute module — yearly balances, end FVs, gap (TDD)"
```

---

## Task 5: Caption timing array

**Files:**
- Create: `packages/video/src/fee-drag/captions.ts`

- [ ] **Step 1: Create `packages/video/src/fee-drag/captions.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/captions.ts
git commit -m "feat(video): caption timing array for fee-drag — 10 cues across 6 scenes"
```

---

## Task 6: VO script file

**Files:**
- Create: `packages/video/src/fee-drag/script.txt`

- [ ] **Step 1: Create `packages/video/src/fee-drag/script.txt`**

```
Over a million dollars — gone. To someone else. Not to you.

Same $500,000 portfolio. Same 7% return. $25,000 added every year. Two advisors.

One charges 1.5% all-in. ArcVest charges 0.5% all-in.

After 30 years, one portfolio ends at 4.3 million. The other at 5.47 million.

That's over a million dollars — going to someone else. Not to you.

See what a fiduciary fee looks like. arcvest dot com slash retirement guide.
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/script.txt
git commit -m "feat(video): VO script — fee-drag, 30s, ~85 words"
```

---

## Task 7: ElevenLabs VO generator

**Files:**
- Create: `packages/video/scripts/generate-vo.ts`
- Modify: `arcvest-marketing/.env.example`

- [ ] **Step 1: Create `packages/video/scripts/generate-vo.ts`**

```ts
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
```

- [ ] **Step 2: Add `ELEVENLABS_API_KEY` to `.env.example`**

Read `.env.example` and find a clean section to add. Append this block at the end:

```
# ElevenLabs (text-to-speech for video VO)
# Key stored in memory reference_elevenlabs.md — "Titanic Polar Bear" key
ELEVENLABS_API_KEY=sk_your_key_here
```

- [ ] **Step 3: Add `ELEVENLABS_API_KEY` to `.env.local`**

Manual step: append the real key from memory `reference_elevenlabs.md` to `/c/code/arcvest-marketing/.env.local`:

```
ELEVENLABS_API_KEY=sk_07c1dc33ba88e544e8d6f0c11f4407e7ef6e22b80665e9d9
```

(Do not commit `.env.local`.)

- [ ] **Step 4: Run the VO generator**

Run from `packages/video/`:
```bash
cd /c/code/arcvest-marketing/packages/video && ELEVENLABS_API_KEY="$(grep '^ELEVENLABS_API_KEY=' ../../.env.local | cut -d= -f2)" npm run vo
```

Expected output:
```
Script: <NNN> chars
Voice: Chad clone (61kW7oMrRBiu4tK5QgOP), model eleven_turbo_v2_5
OK — wrote .../public/vo.mp3 (<NN>.N KB)
```

Verify: `ls -la packages/video/public/vo.mp3` shows a file >50 KB. Play it in any audio player to confirm it's Chad's voice reading the script clearly.

- [ ] **Step 5: Commit**

```bash
git add packages/video/scripts/generate-vo.ts arcvest-marketing/.env.example
git commit -m "feat(video): ElevenLabs VO generator — Chad-clone voice, ArcVest pronunciation dict"
```

---

## Task 8: Scene 1 — Hook Number

**Files:**
- Create: `packages/video/src/fee-drag/scenes/01-HookNumber.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/scenes/01-HookNumber.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';

export const HookNumber: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({ frame, fps, config: { damping: 12, stiffness: 120, mass: 1 } });
  const scale = interpolate(slam, [0, 1], [1.8, 1]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${colors.bg} 0%, ${colors.bgVignette} 100%)`,
        fontFamily: fonts.sans,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 280,
          fontWeight: fontWeights.black,
          fontFamily: fonts.tabular,
          letterSpacing: -8,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        $1.17M
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 44,
          fontWeight: fontWeights.medium,
          color: colors.textSecondary,
          letterSpacing: 2,
          textTransform: 'uppercase',
          opacity: subtitleOpacity,
        }}
      >
        the cost of 1% in fees
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/scenes/01-HookNumber.tsx
git commit -m "feat(video): scene 1 — hook number \$1.17M slam-in"
```

---

## Task 9: Scene 2 — Fee Breakdown Table

**Files:**
- Create: `packages/video/src/fee-drag/scenes/02-FeeBreakdown.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/scenes/02-FeeBreakdown.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

const Row: React.FC<{
  label: string;
  advisory: string;
  product: string;
  total: string;
  color: string;
  rowIndex: number;
}> = ({ label, advisory, product, total, color, rowIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - 20 - rowIndex * 15,
    fps,
    config: { damping: 16, stiffness: 100 },
  });
  const translateX = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 180px 60px 180px 60px 180px',
        alignItems: 'center',
        columnGap: 24,
        padding: '20px 0',
        borderBottom: `1px solid ${colors.gridLine}`,
        fontSize: 44,
        fontFamily: fonts.tabular,
        color,
        transform: `translateX(${translateX}px)`,
        opacity,
      }}
    >
      <div style={{ fontWeight: fontWeights.semibold }}>{label}</div>
      <div style={{ textAlign: 'right' }}>{advisory}</div>
      <div style={{ color: colors.textMuted, textAlign: 'center' }}>+</div>
      <div style={{ textAlign: 'right' }}>{product}</div>
      <div style={{ color: colors.textMuted, textAlign: 'center' }}>=</div>
      <div style={{ textAlign: 'right', fontWeight: fontWeights.bold }}>{total}</div>
    </div>
  );
};

export const FeeBreakdown: React.FC = () => {
  const { advisorA, advisorB } = feeDragConfig;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div style={{ width: 1100 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 180px 60px 180px 60px 180px',
            columnGap: 24,
            fontSize: 26,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          <div></div>
          <div style={{ textAlign: 'right' }}>Advisory</div>
          <div></div>
          <div style={{ textAlign: 'right' }}>Product</div>
          <div></div>
          <div style={{ textAlign: 'right' }}>All-In</div>
        </div>
        <Row
          label={advisorA.label}
          advisory={pct(advisorA.advisoryFee)}
          product={pct(advisorA.productCost)}
          total={pct(advisorA.totalFee)}
          color={colors.advisorA}
          rowIndex={0}
        />
        <Row
          label={advisorB.label}
          advisory={pct(advisorB.advisoryFee)}
          product={pct(advisorB.productCost)}
          total={pct(advisorB.totalFee)}
          color={colors.arcvest}
          rowIndex={1}
        />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/scenes/02-FeeBreakdown.tsx
git commit -m "feat(video): scene 2 — all-in fee breakdown table, staggered row entry"
```

---

## Task 10: Scene 3 — Dual Line Chart

**Files:**
- Create: `packages/video/src/fee-drag/scenes/03-DualLineChart.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/scenes/03-DualLineChart.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances } from '../compute';

const CHART = {
  x: 200,
  y: 200,
  width: 1520,
  height: 680,
};

function pointsPath(values: number[], yMax: number, progressYears: number): string {
  const n = values.length - 1;
  const shown = Math.min(Math.max(progressYears, 0), n);
  const pts: string[] = [];
  for (let i = 0; i <= shown; i++) {
    const x = CHART.x + (CHART.width * i) / n;
    const y = CHART.y + CHART.height - (CHART.height * values[i]) / yMax;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

export const DualLineChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { advA, advB, years } = computeYearlyBalances(feeDragConfig);
  const yMax = Math.max(...advB) * 1.05;
  const progressYears = interpolate(frame, [0, 4 * fps], [0, years.length - 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (yMax * i) / yTicks);

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans, color: colors.textPrimary }}>
      <svg width={1920} height={1080} style={{ display: 'block' }}>
        {yTickValues.map((v, i) => {
          const y = CHART.y + CHART.height - (CHART.height * v) / yMax;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={CHART.x}
                x2={CHART.x + CHART.width}
                y1={y}
                y2={y}
                stroke={colors.gridLine}
                strokeWidth={1}
              />
              <text x={CHART.x - 20} y={y + 8} fill={colors.textMuted} fontSize={22} textAnchor="end" fontFamily={fonts.tabular}>
                ${(v / 1_000_000).toFixed(1)}M
              </text>
            </g>
          );
        })}

        <text x={CHART.x} y={CHART.y - 50} fill={colors.textSecondary} fontSize={32} fontWeight={fontWeights.semibold} fontFamily={fonts.sans}>
          Portfolio value over 30 years
        </text>

        <text x={CHART.x + CHART.width} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={22} textAnchor="end" fontFamily={fonts.tabular}>
          Year 30
        </text>
        <text x={CHART.x} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={22} fontFamily={fonts.tabular}>
          Year 0
        </text>

        <path d={pointsPath(advA, yMax, progressYears)} stroke={colors.advisorA} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d={pointsPath(advB, yMax, progressYears)} stroke={colors.arcvest} strokeWidth={6} fill="none" strokeLinecap="round" />

        <g>
          <circle cx={CHART.x + CHART.width + 40} cy={CHART.y + 40} r={8} fill={colors.arcvest} />
          <text x={CHART.x + CHART.width + 60} y={CHART.y + 48} fill={colors.textPrimary} fontSize={26} fontWeight={fontWeights.semibold} fontFamily={fonts.sans}>
            ArcVest · 0.5%
          </text>
          <circle cx={CHART.x + CHART.width + 40} cy={CHART.y + 90} r={8} fill={colors.advisorA} />
          <text x={CHART.x + CHART.width + 60} y={CHART.y + 98} fill={colors.textSecondary} fontSize={26} fontWeight={fontWeights.medium} fontFamily={fonts.sans}>
            Advisor A · 1.5%
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
```

Note: legend is positioned outside the chart's right edge — since the chart width is 1520 starting at x=200, the right edge is at x=1720. Legend at x=1760 fits within the 1920px frame.

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/scenes/03-DualLineChart.tsx
git commit -m "feat(video): scene 3 — dual line chart building year by year (SVG, deterministic)"
```

---

## Task 11: Scene 4 — Year 30 Reveal

**Files:**
- Create: `packages/video/src/fee-drag/scenes/04-YearThirtyReveal.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/scenes/04-YearThirtyReveal.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatMillions } from '../compute';

export const YearThirtyReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { endA, endB } = computeYearlyBalances(feeDragConfig);

  const aEnter = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 110 } });
  const bEnter = spring({ frame: frame - 45, fps, config: { damping: 14, stiffness: 110 } });

  const aOpacity = interpolate(aEnter, [0, 1], [0, 1]);
  const aTranslate = interpolate(aEnter, [0, 1], [30, 0]);
  const bOpacity = interpolate(bEnter, [0, 1], [0, 1]);
  const bTranslate = interpolate(bEnter, [0, 1], [30, 0]);

  const Col: React.FC<{
    label: string;
    value: string;
    color: string;
    opacity: number;
    translate: number;
  }> = ({ label, value, color, opacity, translate }) => (
    <div style={{ opacity, transform: `translateY(${translate}px)`, textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: fontWeights.medium, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 24 }}>
        {label}
      </div>
      <div style={{ fontSize: 200, fontWeight: fontWeights.black, fontFamily: fonts.tabular, color, letterSpacing: -4 }}>
        {value}
      </div>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 40, color: colors.textMuted, marginBottom: 60, letterSpacing: 4, textTransform: 'uppercase' }}>
        After 30 years
      </div>
      <div style={{ display: 'flex', gap: 180 }}>
        <Col label="Advisor A" value={formatMillions(endA)} color={colors.advisorA} opacity={aOpacity} translate={aTranslate} />
        <Col label="ArcVest" value={formatMillions(endB)} color={colors.arcvest} opacity={bOpacity} translate={bTranslate} />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/scenes/04-YearThirtyReveal.tsx
git commit -m "feat(video): scene 4 — year 30 end-balance reveal, staggered"
```

---

## Task 12: Scene 5 — Gap Callout

**Files:**
- Create: `packages/video/src/fee-drag/scenes/05-GapCallout.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/scenes/05-GapCallout.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatMillions } from '../compute';

export const GapCallout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { gap } = computeYearlyBalances(feeDragConfig);

  const pulse = spring({ frame: frame - 5, fps, config: { damping: 10, stiffness: 80 } });
  const scale = interpolate(pulse, [0, 1], [0.6, 1]);
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  const labelOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${colors.bg} 0%, ${colors.bgVignette} 100%)`,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          padding: '60px 120px',
          background: colors.gapFill,
          border: `4px solid ${colors.gap}`,
          borderRadius: 24,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div style={{ fontSize: 260, fontWeight: fontWeights.black, color: colors.textPrimary, fontFamily: fonts.tabular, letterSpacing: -6, lineHeight: 1 }}>
          {formatMillions(gap)}
        </div>
        <div style={{ fontSize: 44, fontWeight: fontWeights.bold, color: colors.gap, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center', marginTop: 20 }}>
          difference
        </div>
      </div>
      <div style={{ marginTop: 60, fontSize: 38, color: colors.textSecondary, opacity: labelOpacity, textAlign: 'center', maxWidth: 1400 }}>
        going to someone else — not to you
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/scenes/05-GapCallout.tsx
git commit -m "feat(video): scene 5 — gap callout \$1.17M pulse-in with red fill"
```

---

## Task 13: Scene 6 — CTA with Disclaimer

**Files:**
- Create: `packages/video/src/fee-drag/scenes/06-CTA.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/scenes/06-CTA.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const logoScale = interpolate(logo, [0, 1], [0.8, 1]);
  const logoOpacity = interpolate(logo, [0, 1], [0, 1]);

  const urlOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const disclaimerOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          fontSize: 160,
          fontWeight: fontWeights.black,
          color: colors.arcvest,
          letterSpacing: -4,
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
        }}
      >
        ArcVest
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 52,
          fontWeight: fontWeights.semibold,
          color: colors.textPrimary,
          opacity: urlOpacity,
          letterSpacing: 1,
        }}
      >
        {feeDragConfig.cta.displayUrl}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 120,
          right: 120,
          fontSize: 18,
          fontWeight: fontWeights.regular,
          color: colors.textMuted,
          opacity: disclaimerOpacity,
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        {feeDragConfig.disclaimer}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/scenes/06-CTA.tsx
git commit -m "feat(video): scene 6 — CTA, URL, full disclaimer micro-text"
```

---

## Task 14: Captions overlay component

**Files:**
- Create: `packages/video/src/fee-drag/CaptionsOverlay.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/CaptionsOverlay.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';
import { captions } from './captions';

export const CaptionsOverlay: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {captions.map((c, i) => (
        <Sequence key={i} from={c.fromFrame} durationInFrames={c.durationFrames}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 80 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 40,
                fontWeight: fontWeights.semibold,
                color: colors.textPrimary,
                background: 'rgba(10, 14, 20, 0.85)',
                padding: '14px 28px',
                borderRadius: 8,
                maxWidth: 1400,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {c.text}
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/CaptionsOverlay.tsx
git commit -m "feat(video): captions overlay — timed <Sequence> cues"
```

---

## Task 15: Compose FeeDragVideo

**Files:**
- Create: `packages/video/src/fee-drag/FeeDragVideo.tsx`

- [ ] **Step 1: Create `packages/video/src/fee-drag/FeeDragVideo.tsx`**

```tsx
import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { HookNumber } from './scenes/01-HookNumber';
import { FeeBreakdown } from './scenes/02-FeeBreakdown';
import { DualLineChart } from './scenes/03-DualLineChart';
import { YearThirtyReveal } from './scenes/04-YearThirtyReveal';
import { GapCallout } from './scenes/05-GapCallout';
import { CTA } from './scenes/06-CTA';
import { CaptionsOverlay } from './CaptionsOverlay';

const SCENE_DURATION = 150; // frames at 30fps = 5s

export const FeeDragVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <HookNumber />
      </Sequence>
      <Sequence from={1 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <FeeBreakdown />
      </Sequence>
      <Sequence from={2 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <DualLineChart />
      </Sequence>
      <Sequence from={3 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <YearThirtyReveal />
      </Sequence>
      <Sequence from={4 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <GapCallout />
      </Sequence>
      <Sequence from={5 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <CTA />
      </Sequence>
      <CaptionsOverlay />
      <Audio src={staticFile('vo.mp3')} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/video/src/fee-drag/FeeDragVideo.tsx
git commit -m "feat(video): compose FeeDragVideo — 6 scene sequences + captions + audio"
```

---

## Task 16: Register composition in Root

**Files:**
- Modify: `packages/video/src/Root.tsx`
- Create: `packages/video/remotion.config.ts`

- [ ] **Step 1: Replace `packages/video/src/Root.tsx`**

```tsx
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FeeDragVideo } from './fee-drag/FeeDragVideo';
import { feeDragConfig } from './fee-drag/config';

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FeeDrag"
        component={FeeDragVideo}
        durationInFrames={feeDragConfig.video.durationFrames}
        fps={feeDragConfig.video.fps}
        width={feeDragConfig.video.width}
        height={feeDragConfig.video.height}
      />
    </>
  );
};

registerRoot(RemotionRoot);
```

- [ ] **Step 2: Create `packages/video/remotion.config.ts`**

```ts
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(18);
Config.setOverwriteOutput(true);
```

- [ ] **Step 3: Commit**

```bash
git add packages/video/src/Root.tsx packages/video/remotion.config.ts
git commit -m "feat(video): register FeeDrag composition, set render defaults (H.264 CRF 18)"
```

---

## Task 17: Live preview QA

**Files:** none modified in this task

- [ ] **Step 1: Verify `vo.mp3` exists**

Run: `ls -la packages/video/public/vo.mp3`
If missing, re-run Task 7 step 4.

- [ ] **Step 2: Launch Remotion Studio**

Run: `cd /c/code/arcvest-marketing/packages/video && npm run preview`
Expected: Studio opens in browser at http://localhost:3000 showing the FeeDrag composition.

- [ ] **Step 3: Scrub through each scene, verify these acceptance criteria**

Acceptance (each must pass before moving on):

1. Scene 1 (0–5s): "$1.17M" slams in, subtitle "the cost of 1% in fees" appears around 1s
2. Scene 2 (5–10s): Header row visible. Advisor A row slides in before ArcVest row. "All-in" column shows 1.5% / 0.5%.
3. Scene 3 (10–15s): Chart axes visible. Two lines draw year by year starting from left. Legend visible top-right.
4. Scene 4 (15–20s): "After 30 years" label. "$4.30M" (gray) appears before "$5.47M" (ArcVest blue).
5. Scene 5 (20–25s): "$1.17M" pulses in with red fill border. "going to someone else — not to you" appears below.
6. Scene 6 (25–30s): "ArcVest" logo scales in. URL fades in. Disclaimer fades in at bottom.
7. Audio: Chad's voice plays throughout, aligned with captions (voice saying "over a million dollars" matches caption appearing in scene 1).
8. Captions: every scene has at least one caption visible. Captions don't overlap scene transitions awkwardly.

If any scene fails, fix the relevant scene file and re-scrub. No commit needed for visual tweaks; commit only when all criteria pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add packages/video/src/
git commit -m "fix(video): <specific-fix-description>"
```
(Skip if no changes were needed.)

---

## Task 18: Render final MP4 + smoke test output

**Files:** none modified in this task (render artifact only)

- [ ] **Step 1: Render full MP4**

Run: `cd /c/code/arcvest-marketing/packages/video && npm run render`
Expected: terminal shows "Rendering..." progress bar, finishes in ~1–3 minutes, produces `out/fee-drag-30s-16x9.mp4`.

- [ ] **Step 2: Verify file properties**

Run: `ls -lh packages/video/out/fee-drag-30s-16x9.mp4`
Expected: file exists, size between 2 MB and 20 MB.

If `ffprobe` is available:
```bash
ffprobe -v error -show_entries stream=width,height,duration,codec_name -of default=noprint_wrappers=1 packages/video/out/fee-drag-30s-16x9.mp4
```
Expected: `width=1920`, `height=1080`, `duration≈30`, `codec_name=h264`, and a second `codec_name=aac` line for audio.

- [ ] **Step 3: Open and watch the rendered MP4**

Open with system player (Windows: `start packages/video/out/fee-drag-30s-16x9.mp4`).

Acceptance:
1. Video plays start to finish, 30s duration
2. Audio and captions are in sync
3. All 6 scenes render identically to the Studio preview
4. No frame drops, glitches, or corrupted chart paths

- [ ] **Step 4: Run unit tests once more to confirm locked numbers**

Run: `cd /c/code/arcvest-marketing/packages/video && npm run test`
Expected: all 6 assertions still pass. (Regression guard against accidental config changes.)

- [ ] **Step 5: Commit + push**

No code changes to commit (MP4 and vo.mp3 are gitignored). Push accumulated commits:

```bash
cd /c/code/arcvest-marketing && git push
```

- [ ] **Step 6: Report back to user**

Post a summary:
- Path to final MP4: `packages/video/out/fee-drag-30s-16x9.mp4`
- File size and duration confirmed
- All unit tests pass
- Ready for Chad's review before publishing to YouTube

---

## Self-Review Notes

Spec coverage against `2026-04-22-fee-drag-video-design.md`:
- ✅ Numbers ($500K / $25K / 7% / 30y / 1.5% vs 0.5%) — Task 3 + Task 4 tests
- ✅ Six scenes — Tasks 8–13
- ✅ Fee breakdown table (all-in vs all-in) — Task 9
- ✅ Dual line chart (SVG, deterministic) — Task 10
- ✅ Audio via ElevenLabs Chad-clone — Task 7
- ✅ Captions for silent-autoplay — Tasks 5 + 14
- ✅ Disclaimer micro-text on CTA — Task 13
- ✅ Output MP4 at 1920×1080 H.264 — Task 16 + Task 18
- ✅ Unit test regression guard — Task 4 + Task 18 step 4

No TBDs, no placeholder comments. Brand color `#2563EB` is a locked default; it can be swapped in `colors.ts` at any time without code churn elsewhere.
