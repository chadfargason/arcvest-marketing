import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  headline: string;
  subline?: string;
  footer?: string;
}

export const ConceptSlide: React.FC<Props> = ({ headline, subline, footer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [18, 0]);

  const sublineOpacity = interpolate(frame, [14, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const footerOpacity = interpolate(frame, [32, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        // bottom 160px reserved for caption pill (vs uniform 140 prior)
        padding: '140px 140px 200px 140px',
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -2,
          lineHeight: 1.1,
          textAlign: 'center',
          maxWidth: 1600,
          opacity,
          transform: `translateY(${translate}px)`,
        }}
      >
        {headline}
      </div>
      {subline && (
        <div
          style={{
            marginTop: 40,
            fontSize: 48,
            fontWeight: fontWeights.medium,
            color: colors.textSecondary,
            textAlign: 'center',
            maxWidth: 1600,
            lineHeight: 1.35,
            opacity: sublineOpacity,
          }}
        >
          {subline}
        </div>
      )}
      {footer && (
        <div
          style={{
            marginTop: 64,
            fontSize: 32,
            fontWeight: fontWeights.semibold,
            color: colors.gap,
            textTransform: 'uppercase',
            letterSpacing: 4,
            textAlign: 'center',
            opacity: footerOpacity,
          }}
        >
          {footer}
        </div>
      )}
    </AbsoluteFill>
  );
};
