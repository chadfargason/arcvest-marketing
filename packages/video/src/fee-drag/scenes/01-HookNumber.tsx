import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';

export const HookNumber: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({ frame, fps, config: { damping: 12, stiffness: 120, mass: 1 } });
  const scale = interpolate(slam, [0, 1], [1.8, 1]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${colors.bg} 0%, ${colors.bgVignette} 100%)`,
        fontFamily: fonts.sans,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 280,
          fontWeight: fontWeights.black,
          fontFamily: fonts.tabular,
          letterSpacing: -8,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        $1.17M
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 44,
          fontWeight: fontWeights.medium,
          color: colors.textSecondary,
          letterSpacing: 2,
          textTransform: 'uppercase',
          opacity: subtitleOpacity,
        }}
      >
        the cost of 1% in fees
      </div>
    </AbsoluteFill>
  );
};
