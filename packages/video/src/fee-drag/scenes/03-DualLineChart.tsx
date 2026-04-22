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
          <circle cx={CHART.x + CHART.width - 320} cy={CHART.y + 40} r={8} fill={colors.arcvest} />
          <text x={CHART.x + CHART.width - 300} y={CHART.y + 48} fill={colors.textPrimary} fontSize={26} fontWeight={fontWeights.semibold} fontFamily={fonts.sans}>
            ArcVest · 0.5%
          </text>
          <circle cx={CHART.x + CHART.width - 320} cy={CHART.y + 90} r={8} fill={colors.advisorA} />
          <text x={CHART.x + CHART.width - 300} y={CHART.y + 98} fill={colors.textSecondary} fontSize={26} fontWeight={fontWeights.medium} fontFamily={fonts.sans}>
            Advisor A · 1.5%
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
