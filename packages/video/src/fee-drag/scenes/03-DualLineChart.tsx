import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatMillions } from '../compute';

// Merged scene: chart phase (0–575) + shrink transition (575–660) + reveal phase (600–986)
//
// VO 3 (divergence, 612 frames) plays 0–612, word alignments:
//   "year ten"           → f101
//   "year twenty"        → f204
//   "year thirty"        → f307
//   "gap is huge"        → f349
//   "five-point-four-seven" (ArcVest end)  → f437
//   "four-point-three"   (Advisor A end)   → f572
// VO 4 (reveal, 371 frames) plays 615–986, word alignments:
//   "one-point-one-seven" → f18 in VO4  → scene-frame 633
//   "four percent rule"   → f290 in VO4 → scene-frame 905
//   "beach house"         → f346 in VO4 → scene-frame 961

const CHART = {
  x: 200,
  y: 220,
  width: 1520,
  height: 660,
};

// Year anchors locking chart progress to VO mentions
const YEAR_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [101, 10],
  [204, 20],
  [307, 30],
];
const CALLOUT_ARCVEST_FRAME = 437; // when "five-point-four-seven" is spoken
const CALLOUT_ADVISOR_A_FRAME = 572; // when "four-point-three" is spoken

// Transition timing
const SHRINK_START = 580;
const SHRINK_END = 660;
const REVEAL_IN = 600;
const DIGITS_START = 633; // synced to "one-point-one-seven" in VO 4
const FRAMES_PER_GLYPH = 5;

// Rotating subtitles in the reveal panel
const SUBTITLES: ReadonlyArray<{ from: number; until: number; text: string; emphasis?: boolean }> = [
  { from: 680, until: 900, text: "Going to your advisor's retirement — not yours" },
  { from: 905, until: 958, text: '≈ 5 years of retirement income at the 4% rule' },
  { from: 961, until: 986, text: 'Or a beach house.', emphasis: true },
];

function chartYearAtFrame(frame: number): number {
  const last = YEAR_ANCHORS[YEAR_ANCHORS.length - 1];
  if (frame >= last[0]) return last[1];
  for (let i = 1; i < YEAR_ANCHORS.length; i++) {
    const [f0, y0] = YEAR_ANCHORS[i - 1];
    const [f1, y1] = YEAR_ANCHORS[i];
    if (frame <= f1) return y0 + ((frame - f0) / (f1 - f0)) * (y1 - y0);
  }
  return 30;
}

function pointsPath(values: number[], yMax: number, progressYears: number): string {
  const n = values.length - 1;
  const shown = Math.min(Math.max(progressYears, 0), n);
  const wholeYears = Math.floor(shown);
  const frac = shown - wholeYears;
  const pts: string[] = [];
  for (let i = 0; i <= wholeYears; i++) {
    const x = CHART.x + (CHART.width * i) / n;
    const y = CHART.y + CHART.height - (CHART.height * values[i]) / yMax;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  if (wholeYears < n && frac > 0) {
    const v = values[wholeYears] + (values[wholeYears + 1] - values[wholeYears]) * frac;
    const x = CHART.x + (CHART.width * (wholeYears + frac)) / n;
    const y = CHART.y + CHART.height - (CHART.height * v) / yMax;
    pts.push(`L${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

function gapAreaPath(advA: number[], advB: number[], yMax: number, progressYears: number): string {
  const n = advA.length - 1;
  const shown = Math.min(Math.max(progressYears, 0), n);
  const wholeYears = Math.floor(shown);
  const frac = shown - wholeYears;

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= wholeYears; i++) {
    const x = CHART.x + (CHART.width * i) / n;
    pts.push({ x, y: CHART.y + CHART.height - (CHART.height * advB[i]) / yMax });
  }
  if (wholeYears < n && frac > 0) {
    const vB = advB[wholeYears] + (advB[wholeYears + 1] - advB[wholeYears]) * frac;
    const x = CHART.x + (CHART.width * (wholeYears + frac)) / n;
    pts.push({ x, y: CHART.y + CHART.height - (CHART.height * vB) / yMax });
  }
  const ptsBack: { x: number; y: number }[] = [];
  if (wholeYears < n && frac > 0) {
    const vA = advA[wholeYears] + (advA[wholeYears + 1] - advA[wholeYears]) * frac;
    const x = CHART.x + (CHART.width * (wholeYears + frac)) / n;
    ptsBack.push({ x, y: CHART.y + CHART.height - (CHART.height * vA) / yMax });
  }
  for (let i = wholeYears; i >= 0; i--) {
    const x = CHART.x + (CHART.width * i) / n;
    ptsBack.push({ x, y: CHART.y + CHART.height - (CHART.height * advA[i]) / yMax });
  }
  const all = [...pts, ...ptsBack];
  if (all.length === 0) return '';
  return all.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';
}

const YearLabel: React.FC<{
  year: number;
  values: { advA: number; advB: number };
  yMax: number;
  appearAtFrame: number;
}> = ({ year, values, yMax, appearAtFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - appearAtFrame,
    fps,
    config: { damping: 14, stiffness: 110 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  const n = feeDragConfig.horizonYears;
  const xLine = CHART.x + (CHART.width * year) / n;
  const yA = CHART.y + CHART.height - (CHART.height * values.advA) / yMax;
  const yB = CHART.y + CHART.height - (CHART.height * values.advB) / yMax;
  const labelY = Math.min(yA, yB) - 26;

  return (
    <g style={{ opacity }}>
      <line x1={xLine} x2={xLine} y1={yA} y2={CHART.y + CHART.height} stroke={colors.divider} strokeWidth={1} strokeDasharray="4,4" />
      <rect x={xLine - 130} y={labelY - 66} width={260} height={60} rx={10} fill="#FFFFFF" stroke={colors.textSecondary} strokeWidth={1.5} />
      <text x={xLine} y={labelY - 42} textAnchor="middle" fill={colors.textSecondary} fontSize={20} fontFamily="Arial, sans-serif" fontWeight={600} letterSpacing={2}>
        {`YEAR ${year}`}
      </text>
      <text x={xLine} y={labelY - 16} textAnchor="middle" fill={colors.arcvest} fontSize={24} fontFamily="Arial, sans-serif" fontWeight={800}>
        {formatMillions(values.advB)}
      </text>
    </g>
  );
};

const EndpointCallout: React.FC<{
  cx: number;
  cy: number;
  text: string;
  color: string;
  appearAtFrame: number;
  anchor: 'above' | 'below';
}> = ({ cx, cy, text, color, appearAtFrame, anchor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - appearAtFrame,
    fps,
    config: { damping: 11, stiffness: 130 },
  });
  const scale = interpolate(enter, [0, 1], [0.6, 1]);
  const opacity = interpolate(frame, [appearAtFrame, appearAtFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY = anchor === 'above' ? cy - 60 : cy + 70;

  return (
    <g style={{ opacity, transform: `scale(${scale})`, transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy} r={11} fill={color} stroke="#FFFFFF" strokeWidth={3} />
      <rect x={cx - 110} y={labelY - 30} width={220} height={52} rx={10} fill={color} />
      <text x={cx} y={labelY + 5} textAnchor="middle" fill="#FFFFFF" fontSize={30} fontFamily="Arial, sans-serif" fontWeight={900}>
        {text}
      </text>
    </g>
  );
};

const Subtitle: React.FC<{ from: number; text: string; emphasis: boolean }> = ({ from, text, emphasis }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [from, from + 18], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        fontSize: emphasis ? 54 : 32,
        fontWeight: emphasis ? fontWeights.black : fontWeights.medium,
        color: emphasis ? colors.gap : colors.textSecondary,
        opacity,
        transform: `translateY(${translateY}px)`,
        textAlign: 'center',
        lineHeight: 1.25,
        letterSpacing: emphasis ? 1 : 0,
        marginTop: 36,
        padding: '0 20px',
      }}
    >
      {text}
    </div>
  );
};

export const DualLineChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { advA, advB } = computeYearlyBalances(feeDragConfig);
  const yMax = Math.max(...advB) * 1.05;

  const progressYears = chartYearAtFrame(frame);
  const currentYear = Math.min(Math.floor(progressYears), 30);

  // Transition interpolants
  const shrink = interpolate(frame, [SHRINK_START, SHRINK_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const chartScale = interpolate(shrink, [0, 1], [1, 0.6]);
  const chartTranslateY = interpolate(shrink, [0, 1], [0, 216]);
  // Fade out in-chart title/legend once we begin shrinking (they'd otherwise look cramped)
  const titleOpacity = interpolate(frame, [SHRINK_START, SHRINK_START + 40], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const counterPulse = spring({
    frame: frame - currentYear * 18,
    fps,
    config: { damping: 18, stiffness: 200 },
  });
  const counterScale = interpolate(counterPulse, [0, 1], [1.15, 1]);
  const counterOpacity = titleOpacity;

  // "The gap is huge" emphasis label — appears at f349 when VO says it
  const gapHugeOpacity = interpolate(frame, [349, 365, SHRINK_START, SHRINK_START + 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Reveal panel (right 40%) fade-in
  const revealOpacity = interpolate(frame, [REVEAL_IN, REVEAL_IN + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const heroText = feeDragConfig.heroGapDisplay; // "$1,170,000"

  // Endpoint coords
  const xEnd = CHART.x + CHART.width;
  const yEndB = CHART.y + CHART.height - (CHART.height * advB[30]) / yMax;
  const yEndA = CHART.y + CHART.height - (CHART.height * advA[30]) / yMax;

  const activeSubtitle = SUBTITLES.find((s) => frame >= s.from && frame < s.until);

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans, color: colors.textPrimary }}>
      {/* Chart container — scales + translates during shrink transition */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          transform: `translateY(${chartTranslateY}px) scale(${chartScale})`,
          transformOrigin: 'top left',
        }}
      >
        <svg width={1920} height={1080} style={{ display: 'block' }}>
          {/* Title + subtitle (fades out when chart shrinks) */}
          <g style={{ opacity: titleOpacity }}>
            <text x={CHART.x} y={95} fill={colors.textPrimary} fontSize={42} fontWeight={700} fontFamily="Arial, sans-serif">
              Portfolio value over time
            </text>
            <text x={CHART.x} y={135} fill={colors.textMuted} fontSize={22} fontFamily="Arial, sans-serif">
              Same investor, two advisors. Only the fee differs.
            </text>
          </g>

          {/* Grid lines + y-axis labels */}
          {Array.from({ length: 6 }, (_, i) => {
            const v = (yMax * i) / 5;
            const y = CHART.y + CHART.height - (CHART.height * v) / yMax;
            return (
              <g key={`grid-${i}`}>
                <line x1={CHART.x} x2={CHART.x + CHART.width} y1={y} y2={y} stroke={colors.gridLine} strokeWidth={1} />
                <text x={CHART.x - 20} y={y + 8} fill={colors.textMuted} fontSize={20} textAnchor="end" fontFamily="Arial, sans-serif">
                  ${(v / 1_000_000).toFixed(1)}M
                </text>
              </g>
            );
          })}

          <text x={CHART.x} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={20} fontFamily="Arial, sans-serif">
            Year 0
          </text>
          <text x={CHART.x + CHART.width} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={20} textAnchor="end" fontFamily="Arial, sans-serif">
            Year 30
          </text>

          {/* Gap fill + lines */}
          <path d={gapAreaPath(advA, advB, yMax, progressYears)} fill={colors.gapFill} />
          <path d={pointsPath(advA, yMax, progressYears)} stroke={colors.advisorA} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pointsPath(advB, yMax, progressYears)} stroke={colors.arcvest} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Year labels */}
          {progressYears >= 10 && <YearLabel year={10} values={{ advA: advA[10], advB: advB[10] }} yMax={yMax} appearAtFrame={101} />}
          {progressYears >= 20 && <YearLabel year={20} values={{ advA: advA[20], advB: advB[20] }} yMax={yMax} appearAtFrame={204} />}
          {progressYears >= 30 && <YearLabel year={30} values={{ advA: advA[30], advB: advB[30] }} yMax={yMax} appearAtFrame={307} />}

          {/* Endpoint callouts */}
          {frame >= CALLOUT_ARCVEST_FRAME && (
            <EndpointCallout cx={xEnd} cy={yEndB} text="$5.47M" color={colors.arcvest} appearAtFrame={CALLOUT_ARCVEST_FRAME} anchor="above" />
          )}
          {frame >= CALLOUT_ADVISOR_A_FRAME && (
            <EndpointCallout cx={xEnd} cy={yEndA} text="$4.30M" color={colors.advisorA} appearAtFrame={CALLOUT_ADVISOR_A_FRAME} anchor="below" />
          )}

          {/* Legend (fades with title) */}
          <g style={{ opacity: titleOpacity }}>
            <circle cx={CHART.x + 30} cy={CHART.y - 40} r={8} fill={colors.arcvest} />
            <text x={CHART.x + 50} y={CHART.y - 32} fill={colors.textPrimary} fontSize={22} fontWeight={600} fontFamily="Arial, sans-serif">
              ArcVest · 0.5%
            </text>
            <circle cx={CHART.x + 330} cy={CHART.y - 40} r={8} fill={colors.advisorA} />
            <text x={CHART.x + 350} y={CHART.y - 32} fill={colors.textSecondary} fontSize={22} fontWeight={500} fontFamily="Arial, sans-serif">
              Advisor A · 1.5%
            </text>
          </g>
        </svg>

        {/* Year counter — top right */}
        <div
          style={{
            position: 'absolute',
            top: 90,
            right: 100,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            fontSize: 78,
            color: colors.textPrimary,
            letterSpacing: -2,
            transform: `scale(${counterScale})`,
            transformOrigin: 'right',
            opacity: counterOpacity,
          }}
        >
          Year {currentYear}
        </div>
      </div>

      {/* "The gap is huge" emphasis label — large red text mid-chart, briefly */}
      {gapHugeOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 180,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: fonts.sans,
            fontSize: 72,
            fontWeight: fontWeights.black,
            color: colors.gap,
            letterSpacing: -1,
            opacity: gapHugeOpacity,
            textShadow: '0 2px 20px rgba(255,255,255,0.9)',
          }}
        >
          The gap is huge.
        </div>
      )}

      {/* Right-side reveal panel — fades in during chart shrink */}
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 150,
          width: 680,
          height: 820,
          opacity: revealOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '40px 20px',
        }}
      >
        {/* Hero number box */}
        <div
          style={{
            padding: '36px 44px',
            background: colors.gapFillStrong,
            border: `3px solid ${colors.gap}`,
            borderRadius: 18,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: colors.textSecondary,
              fontWeight: fontWeights.medium,
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Lost to fees
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: fontWeights.black,
              color: colors.textPrimary,
              fontFamily: fonts.tabular,
              letterSpacing: -2,
              lineHeight: 1,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {heroText.split('').map((g, i) => {
              const start = DIGITS_START + i * FRAMES_PER_GLYPH;
              const op = interpolate(frame, [start, start + 5], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const ty = interpolate(frame, [start, start + 10], [-16, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <span key={i} style={{ opacity: op, transform: `translateY(${ty}px)`, display: 'inline-block' }}>
                  {g}
                </span>
              );
            })}
          </div>
        </div>

        {/* Rotating subtitles below the hero */}
        {activeSubtitle && (
          <Subtitle key={activeSubtitle.from} from={activeSubtitle.from} text={activeSubtitle.text} emphasis={activeSubtitle.emphasis ?? false} />
        )}
      </div>
    </AbsoluteFill>
  );
};
