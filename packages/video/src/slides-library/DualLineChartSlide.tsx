import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  heading: string;
  subheading?: string;
  winnerLabel: string;
  winnerEndValue: string;
  loserLabel: string;
  loserEndValue: string;
  caveat?: string;
  period?: string;
  // Optional real-data monthly cumulative paths. If provided, rendered instead
  // of the synthetic compound-growth curve. Should be a series of dollar values
  // (e.g. [1.00, 0.96, 0.98, 1.02, ...]) where winnerPath[0] and loserPath[0] = 1.0.
  winnerPath?: number[];
  loserPath?: number[];
}

// Simple visual: two curves + end-value callouts. Uses real paths if supplied.
export const DualLineChartSlide: React.FC<Props> = ({
  heading,
  subheading,
  winnerLabel,
  winnerEndValue,
  loserLabel,
  loserEndValue,
  caveat,
  period = '2016 – 2025',
  winnerPath,
  loserPath,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const CHART = { x: 240, y: 250, width: 1440, height: 600 };

  // If paths provided use them; otherwise synthesize smooth 10-year compound curves from the end values.
  const winnerEnd = parseFloat(winnerEndValue.replace(/[^0-9.]/g, ''));
  const loserEnd = parseFloat(loserEndValue.replace(/[^0-9.]/g, ''));
  const winnerCurve = winnerPath
    ? winnerPath
    : Array.from({ length: 11 }, (_, i) => Math.pow(winnerEnd, i / 10));
  const loserCurve = loserPath
    ? loserPath
    : Array.from({ length: 11 }, (_, i) => Math.pow(loserEnd, i / 10));

  const nWinner = winnerCurve.length - 1;
  const nLoser = loserCurve.length - 1;
  // Use the longer of the two as the x-axis length for consistency
  const totalPoints = Math.max(nWinner, nLoser);
  const yMaxCandidate = Math.max(...winnerCurve, ...loserCurve);
  const yMax = yMaxCandidate * 1.08;

  const DRAW_END = 90;
  const progressPoints = interpolate(frame, [15, DRAW_END], [0, totalPoints], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const yTickValues = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const pathForCurve = (values: number[]): string => {
    const nCurve = values.length - 1;
    // Progress in the curve's own index space (scaled to totalPoints)
    const p = (progressPoints / totalPoints) * nCurve;
    const wholeIndex = Math.floor(p);
    const frac = p - wholeIndex;
    const pts: string[] = [];
    for (let i = 0; i <= wholeIndex; i++) {
      const x = CHART.x + (CHART.width * i) / nCurve;
      const y = CHART.y + CHART.height - (CHART.height * values[i]) / yMax;
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    if (wholeIndex < nCurve && frac > 0) {
      const v = values[wholeIndex] + (values[wholeIndex + 1] - values[wholeIndex]) * frac;
      const x = CHART.x + (CHART.width * (wholeIndex + frac)) / nCurve;
      const y = CHART.y + CHART.height - (CHART.height * v) / yMax;
      pts.push(`L${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(' ');
  };

  const calloutWinnerSpring = spring({ frame: frame - DRAW_END - 8, fps, config: { damping: 12, stiffness: 130 } });
  const calloutLoserSpring = spring({ frame: frame - DRAW_END - 24, fps, config: { damping: 12, stiffness: 130 } });

  const winnerY = CHART.y + CHART.height - (CHART.height * winnerCurve[winnerCurve.length - 1]) / yMax;
  const loserY = CHART.y + CHART.height - (CHART.height * loserCurve[loserCurve.length - 1]) / yMax;

  const Callout: React.FC<{ y: number; label: string; value: string; color: string; enter: number }> = ({ y, label, value, color, enter }) => {
    const scale = interpolate(enter, [0, 1], [0.7, 1]);
    const op = interpolate(enter, [0, 1], [0, 1]);
    return (
      <g style={{ opacity: op, transform: `scale(${scale})`, transformOrigin: `${CHART.x + CHART.width}px ${y}px` }}>
        <circle cx={CHART.x + CHART.width} cy={y} r={13} fill={color} stroke="#FFFFFF" strokeWidth={4} />
        <rect x={CHART.x + CHART.width + 30} y={y - 40} width={240} height={82} rx={10} fill={color} />
        <text x={CHART.x + CHART.width + 150} y={y - 7} textAnchor="middle" fill="#FFFFFF" fontSize={24} fontFamily="Arial, sans-serif" fontWeight={600} letterSpacing={2}>
          {label.toUpperCase()}
        </text>
        <text x={CHART.x + CHART.width + 150} y={y + 26} textAnchor="middle" fill="#FFFFFF" fontSize={36} fontFamily="Arial, sans-serif" fontWeight={900}>
          {value}
        </text>
      </g>
    );
  };

  const displaySubheading = subheading ?? `$1 invested, total return  ·  ${period}`;

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans, color: colors.textPrimary }}>
      <svg width={1920} height={1080} style={{ display: 'block' }}>
        <text x={CHART.x} y={110} fill={colors.textPrimary} fontSize={56} fontWeight={800} fontFamily="Arial, sans-serif">
          {heading}
        </text>
        <text x={CHART.x} y={170} fill={colors.textMuted} fontSize={26} fontFamily="Arial, sans-serif">
          {displaySubheading}
        </text>

        {yTickValues.map((v, i) => {
          const y = CHART.y + CHART.height - (CHART.height * v) / yMax;
          return (
            <g key={`grid-${i}`}>
              <line x1={CHART.x} x2={CHART.x + CHART.width} y1={y} y2={y} stroke={colors.gridLine} strokeWidth={1} />
              <text x={CHART.x - 20} y={y + 8} fill={colors.textMuted} fontSize={22} textAnchor="end" fontFamily="Arial, sans-serif">
                ${v.toFixed(2)}
              </text>
            </g>
          );
        })}

        <text x={CHART.x} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={22} fontFamily="Arial, sans-serif">
          {period.split('–')[0]?.trim() ?? 'Year 0'}
        </text>
        <text x={CHART.x + CHART.width} y={CHART.y + CHART.height + 50} fill={colors.textMuted} fontSize={22} textAnchor="end" fontFamily="Arial, sans-serif">
          {period.split('–')[1]?.trim() ?? 'Year 10'}
        </text>

        <path d={pathForCurve(loserCurve)} stroke={colors.advisorA} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathForCurve(winnerCurve)} stroke={colors.arcvest} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {frame >= DRAW_END + 8 && <Callout y={winnerY} label={winnerLabel} value={winnerEndValue} color={colors.arcvest} enter={calloutWinnerSpring} />}
        {frame >= DRAW_END + 24 && <Callout y={loserY} label={loserLabel} value={loserEndValue} color={colors.advisorA} enter={calloutLoserSpring} />}
      </svg>

      {caveat && (
        <div
          style={{
            position: 'absolute',
            bottom: 200,                  // raised from 160 — keeps caveat above the caption pill
            left: 240,
            right: 240,
            textAlign: 'center',
            fontSize: 28,
            fontWeight: fontWeights.medium,
            color: colors.gap,
            letterSpacing: 2,
            opacity: interpolate(frame, [DRAW_END + 40, DRAW_END + 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          {caveat}
        </div>
      )}
    </AbsoluteFill>
  );
};
