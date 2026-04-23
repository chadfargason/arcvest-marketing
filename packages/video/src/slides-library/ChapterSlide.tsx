import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  kicker?: string;
  title: string;
}

export const ChapterSlide: React.FC<Props> = ({ kicker, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [20, 0]);
  const kickerOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 120,
      }}
    >
      <div
        style={{
          width: 80,
          height: 4,
          background: colors.arcvest,
          marginBottom: 40,
          opacity: kickerOpacity,
        }}
      />
      {kicker && (
        <div
          style={{
            fontSize: 30,
            fontWeight: fontWeights.semibold,
            color: colors.arcvest,
            letterSpacing: 5,
            textTransform: 'uppercase',
            marginBottom: 30,
            opacity: kickerOpacity,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontSize: 128,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -3,
          lineHeight: 1.05,
          textAlign: 'center',
          maxWidth: 1600,
          opacity,
          transform: `translateY(${translate}px)`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};
