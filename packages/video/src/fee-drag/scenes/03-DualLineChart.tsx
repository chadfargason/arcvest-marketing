import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatMillions } from '../compute';

const CHART = {
  x: 200,
  y: 220,
  width: 1520,
  height: 660,
};

// Piecewise anchors locking chart progress to VO mentions of "year ten/twenty/thirty"
// from vo-3-divergence.json. Scene-relative frames.
// VO starts at scene-frame 0. "year ten" @ 3.76s, "year twenty" @ 7.31s, "year thirty" @ 10.89s.
const YEAR_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [113, 10],
  [219, 20],
  [327, 30],
];

// Post-30 callout frames — ArcVest ending ($5.47M) and Advisor A ending ($4.30M)
const CALLOUT_ARCVEST_FRAME = 401;
const CALLOUT_ADVISOR_A_FRAME = 528;

function chartYearAtFrame(frame: number): number {
  if (frame >= YEAR_ANCHORS[YEAR_ANCHORS.length - 1][0]) return 30;
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
  return all
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ') + ' Z';
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
  const labelY = Math.min(yA, yB) - 20;

  return (
    <g style={{ opacity }}>
      <line x1={xLine} x2={xLine} y1={yA} y2={CHART.y + CHART.height} stroke={colors.divider} strokeWidth={1} strokeDasharray="4,4" />
      <rect x={xLine - 110} y={labelY - 60} width={220} height={56} rx={8} fill={colors.bgCard} stroke={colors.divider} strokeWidth={1} />
      <text x={xLine} y={labelY - 35} textAnchor="middle" fill={colors.textMuted} fontSize={18} fontFamily={fonts.sans} fontWeight={fontWeights.medium} letterSpacing={2}>
        {`YEAR ${year}`}
      </text>
      <text x={xLine} y={labelY - 12} textAnchor="middle" fill={colors.arcvest} fontSize={22} fontFamily={fonts.tabular} fontWeight={fontWeights.bold}>
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
      <circle cx={cx} cy={cy} r={11} fill={color} stroke={colors.bgCard} strokeWidth={3} />
      <rect x={cx - 110} y={labelY - 30} width={220} height={52} rx={10} fill={color} />
      <text x={cx} y={labelY + 5} textAnchor="middle" fill={colors.bgCard} fontSize={30} fontFamily={fonts.tabular} fontWeight={fontWeights.black}>
        {text}
      </text>
    </g>
  );
};

export const DualLineChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { advA, advB } = computeYearlyBalances(feeDragConfig);
  const yMax = Math.max(...advB) * 1.05;

  const progressYears = chartYearAtFrame(frame);
  const currentYear = Math.min(Math.floor(progressYears), 30);

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (yMax * i) / yTicks);

  const counterPulse = spring({
    frame: frame - currentYear * 18,
    fps,
    config: { damping: 18, stiffness: 200 },
  });
  const counterScale = interpolate(counterPulse, [0, 1], [1.15, 1]);

  // Endpoint (year 30) coordinates
  const xEnd = CHART.x + CHART.width;
  const yEndB = CHART.y + CHART.height - (CHART.height * advB[30]) / yMax;
  const yEndA = CHART.y + CHART.height - (CHART.height * advA[30]) / yMax;

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans, color: colors.textPrimary }}>
      <svg width={1920} height={1080} style={{ display: 'block' }}>
        <text x={CHART.x} y={120} fill={colors.textPrimary} fontSize={42} fontWeight={fontWeights.bold} fontFamily={fonts.sans}>
          Portfolio value over time
        </text>
        <text x={CHART.x} y={160} fill={colors.textMuted} fontSize={22} fontFamily={fonts.sans}>
          Same investor, two advisors. Only the fee differs.
        </text>

        {yTickValues.map((v, i) => {
          const y = CHART.y + CHART.height - (CHART.height * v) / yMax;
          return (
            <g key={`grid-${i}`}>
              <line x1={CHART.x} x2={CHART.x + CHART.width} y1={y} y2={y} stroke={colors.gridLine} strokeWidth={1} />
              <text x={CHART.x - 20} y={y + 8} fill={colors.textMuted} fontSize={20} textAnchor="end" fontFamily={fonts.tabular}>
                ${(v / 1_000_000).toFixed(1)}M
              </text>
            </g>
          );
        })}

        <text x={CHART.x} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={20} fontFamily={fonts.tabular}>
          Year 0
        </text>
        <text x={CHART.x + CHART.width} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={20} textAnchor="end" fontFamily={fonts.tabular}>
          Year 30
        </text>

        <path d={gapAreaPath(advA, advB, yMax, progressYears)} fill={colors.gapFill} />

        <path d={pointsPath(advA, yMax, progressYears)} stroke={colors.advisorA} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pointsPath(advB, yMax, progressYears)} stroke={colors.arcvest} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {progressYears >= 10 && (
          <YearLabel year={10} values={{ advA: advA[10], advB: advB[10] }} yMax={yMax} appearAtFrame={113} />
        )}
        {progressYears >= 20 && (
          <YearLabel year={20} values={{ advA: advA[20], advB: advB[20] }} yMax={yMax} appearAtFrame={219} />
        )}
        {progressYears >= 30 && (
          <YearLabel year={30} values={{ advA: advA[30], advB: advB[30] }} yMax={yMax} appearAtFrame={327} />
        )}

        {frame >= CALLOUT_ARCVEST_FRAME && (
          <EndpointCallout cx={xEnd} cy={yEndB} text="$5.47M" color={colors.arcvest} appearAtFrame={CALLOUT_ARCVEST_FRAME} anchor="above" />
        )}
        {frame >= CALLOUT_ADVISOR_A_FRAME && (
          <EndpointCallout cx={xEnd} cy={yEndA} text="$4.30M" color={colors.advisorA} appearAtFrame={CALLOUT_ADVISOR_A_FRAME} anchor="below" />
        )}

        <g>
          <circle cx={CHART.x + 30} cy={CHART.y - 100} r={8} fill={colors.arcvest} />
          <text x={CHART.x + 50} y={CHART.y - 92} fill={colors.textPrimary} fontSize={24} fontWeight={fontWeights.semibold} fontFamily={fonts.sans}>
            ArcVest · 0.5%
          </text>
          <circle cx={CHART.x + 320} cy={CHART.y - 100} r={8} fill={colors.advisorA} />
          <text x={CHART.x + 340} y={CHART.y - 92} fill={colors.textSecondary} fontSize={24} fontWeight={fontWeights.medium} fontFamily={fonts.sans}>
            Advisor A · 1.5%
          </text>
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 90,
          right: 100,
          fontFamily: fonts.tabular,
          fontWeight: fontWeights.black,
          fontSize: 78,
          color: colors.textPrimary,
          letterSpacing: -2,
          transform: `scale(${counterScale})`,
          transformOrigin: 'right',
        }}
      >
        Year {currentYear}
      </div>
    </AbsoluteFill>
  );
};
