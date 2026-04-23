import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  quote: string;
  attribution?: string;
}

export const QuoteSlide: React.FC<Props> = ({ quote, attribution }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [20, 0]);

  const attrOpacity = interpolate(frame, [28, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 140,
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: fontWeights.medium,
          color: colors.textPrimary,
          letterSpacing: -0.5,
          lineHeight: 1.28,
          textAlign: 'center',
          maxWidth: 1500,
          fontStyle: 'italic',
          opacity,
          transform: `translateY(${translate}px)`,
        }}
      >
        {quote}
      </div>
      {attribution && (
        <div
          style={{
            marginTop: 60,
            fontSize: 28,
            fontWeight: fontWeights.semibold,
            color: colors.textMuted,
            letterSpacing: 3,
            textTransform: 'uppercase',
            opacity: attrOpacity,
          }}
        >
          — {attribution}
        </div>
      )}
    </AbsoluteFill>
  );
};
