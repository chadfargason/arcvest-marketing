import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  kicker?: string;
  value: string;
  context: string;
  attribution?: string;
  emphasisColor?: 'arcvest' | 'gap';
}

export const StatSlide: React.FC<Props> = ({ kicker, value, context, attribution, emphasisColor = 'arcvest' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const kickerOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const valueSpring = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 100 } });
  const valueScale = interpolate(valueSpring, [0, 1], [0.78, 1]);
  const valueOpacity = interpolate(valueSpring, [0, 1], [0, 1]);
  const contextOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const attributionOpacity = interpolate(frame, [40, 56], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const statColor = emphasisColor === 'gap' ? colors.gap : colors.arcvest;

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '120px 120px 180px 120px',
      }}
    >
      {kicker && (
        <div
          style={{
            fontSize: 28,
            fontWeight: fontWeights.semibold,
            color: colors.textMuted,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 40,
            opacity: kickerOpacity,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontSize: 240,
          fontWeight: fontWeights.black,
          fontFamily: fonts.tabular,
          color: statColor,
          letterSpacing: -6,
          lineHeight: 1,
          textAlign: 'center',
          transform: `scale(${valueScale})`,
          opacity: valueOpacity,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 44,
          fontWeight: fontWeights.medium,
          color: colors.textSecondary,
          textAlign: 'center',
          maxWidth: 1500,
          lineHeight: 1.3,
          opacity: contextOpacity,
        }}
      >
        {context}
      </div>
      {attribution && (
        <div
          style={{
            marginTop: 32,
            fontSize: 22,
            fontWeight: fontWeights.regular,
            color: colors.textMuted,
            letterSpacing: 2,
            textTransform: 'uppercase',
            opacity: attributionOpacity,
          }}
        >
          {attribution}
        </div>
      )}
    </AbsoluteFill>
  );
};
