import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

interface StatRow {
  label: string;
  value: string;
  appearAt: number;
  highlightFee?: boolean;
}

const Side: React.FC<{
  title: string;
  titleColor: string;
  rows: StatRow[];
  align: 'left' | 'right';
}> = ({ title, titleColor, rows, align }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleEnter = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const titleOpacity = interpolate(titleEnter, [0, 1], [0, 1]);
  const titleTranslate = interpolate(titleEnter, [0, 1], [20, 0]);

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align === 'left' ? 'flex-end' : 'flex-start',
        padding: '0 100px',
      }}
    >
      <div
        style={{
          fontSize: 60,
          fontWeight: fontWeights.bold,
          color: titleColor,
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginBottom: 60,
          opacity: titleOpacity,
          transform: `translateY(${titleTranslate}px)`,
          textAlign: align === 'left' ? 'right' : 'left',
        }}
      >
        {title}
      </div>
      {rows.map((row, i) => {
        const enter = spring({
          frame: frame - row.appearAt,
          fps,
          config: { damping: 16, stiffness: 100 },
        });
        const opacity = interpolate(enter, [0, 1], [0, 1]);
        const translateY = interpolate(enter, [0, 1], [25, 0]);
        const highlightOpacity = row.highlightFee
          ? interpolate(frame, [row.appearAt + 30, row.appearAt + 50], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 0;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: align === 'left' ? 'flex-end' : 'flex-start',
              marginBottom: 22,
              opacity,
              transform: `translateY(${translateY}px)`,
              position: 'relative',
            }}
          >
            <div style={{ fontSize: 22, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', fontWeight: fontWeights.medium }}>
              {row.label}
            </div>
            <div
              style={{
                fontSize: row.highlightFee ? 88 : 56,
                fontFamily: fonts.tabular,
                fontWeight: row.highlightFee ? fontWeights.black : fontWeights.semibold,
                color: row.highlightFee ? titleColor : colors.textPrimary,
                letterSpacing: -2,
                marginTop: 4,
                position: 'relative',
                padding: row.highlightFee ? '0 16px' : 0,
                background: row.highlightFee
                  ? `linear-gradient(transparent 60%, ${titleColor}22 60%)`
                  : 'transparent',
                opacity: row.highlightFee ? Math.max(opacity, highlightOpacity) : opacity,
              }}
            >
              {row.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const SplitScreen: React.FC = () => {
  const { advisorA, advisorB } = feeDragConfig;
  const fmt = (v: number) => `$${v.toLocaleString('en-US')}`;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  // Timing locked to VO ("vo-2-setup") word-level alignments:
  //   "half a million"          → 2.98s (frame 90)
  //   "seven percent"           → 5.03s (frame 151)
  //   "twenty-five thousand"    → 7.50s (frame 225)
  //   "one-point-five percent"  → 9.78s (frame 293)
  //   "point-five percent"      → 10.09s (frame 303)
  const aRows: StatRow[] = [
    { label: 'Starting balance', value: fmt(feeDragConfig.startingBalance), appearAt: 90 },
    { label: 'Annual return', value: pct(feeDragConfig.grossReturn), appearAt: 151 },
    { label: 'Added per year', value: fmt(feeDragConfig.annualContribution), appearAt: 225 },
    { label: 'All-in fees', value: pct(advisorA.totalFee), appearAt: 293, highlightFee: true },
  ];
  const bRows: StatRow[] = [
    { label: 'Starting balance', value: fmt(feeDragConfig.startingBalance), appearAt: 90 },
    { label: 'Annual return', value: pct(feeDragConfig.grossReturn), appearAt: 151 },
    { label: 'Added per year', value: fmt(feeDragConfig.annualContribution), appearAt: 225 },
    { label: 'All-in fees', value: pct(advisorB.totalFee), appearAt: 303, highlightFee: true },
  ];

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans, display: 'flex', flexDirection: 'row' }}>
      <Side title="Advisor A" titleColor={colors.advisorA} rows={aRows} align="left" />
      <div style={{ width: 1, background: colors.divider, margin: '120px 0' }} />
      <Side title="ArcVest" titleColor={colors.arcvest} rows={bRows} align="right" />
    </AbsoluteFill>
  );
};
