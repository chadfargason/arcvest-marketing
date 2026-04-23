import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Row {
  label: string;
  value: number;
  display: string;
  isWinner?: boolean;
}

interface Props {
  heading: string;
  subheading?: string;
  rows: Row[];
  unit?: string;
  framesBetween?: number;
}

export const ScoreboardSlide: React.FC<Props> = ({ heading, subheading, rows, framesBetween = 18 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const maxValue = sorted[0].value * 1.05;

  const headingOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const subheadingOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans, padding: '90px 140px' }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -1,
          marginBottom: 14,
          opacity: headingOpacity,
        }}
      >
        {heading}
      </div>
      {subheading && (
        <div
          style={{
            fontSize: 26,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            marginBottom: 60,
            opacity: subheadingOpacity,
          }}
        >
          {subheading}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 28, justifyContent: 'center' }}>
        {sorted.map((row, i) => {
          const appearFrame = 18 + (i + 1) * framesBetween;
          const enter = spring({ frame: frame - appearFrame, fps, config: { damping: 14, stiffness: 100 } });
          const barWidth = interpolate(enter, [0, 1], [0, (row.value / maxValue) * 1400]);
          const opacity = interpolate(enter, [0, 1], [0, 1]);
          const barColor = row.isWinner ? colors.arcvest : colors.advisorA;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, opacity }}>
              <div
                style={{
                  width: 320,
                  minWidth: 320,
                  maxWidth: 320,
                  flexShrink: 0,
                  flexGrow: 0,
                  fontSize: 38,
                  fontWeight: fontWeights.semibold,
                  color: colors.textPrimary,
                  textAlign: 'right',
                }}
              >
                {row.label}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div
                  style={{
                    height: 56,
                    width: barWidth,
                    background: barColor,
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: fontWeights.black,
                    fontFamily: fonts.tabular,
                    color: barColor,
                    letterSpacing: -1,
                  }}
                >
                  {row.display}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
