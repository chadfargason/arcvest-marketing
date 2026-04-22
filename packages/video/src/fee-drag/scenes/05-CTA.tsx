import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const logoScale = interpolate(logo, [0, 1], [0.85, 1]);
  const logoOpacity = interpolate(logo, [0, 1], [0, 1]);

  const urlOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const disclaimerOpacity = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          fontSize: 180,
          fontWeight: fontWeights.black,
          color: colors.arcvest,
          letterSpacing: -5,
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
        }}
      >
        ArcVest
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 56,
          fontWeight: fontWeights.semibold,
          color: colors.textPrimary,
          opacity: urlOpacity,
          letterSpacing: 1,
        }}
      >
        {feeDragConfig.cta.displayUrl}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 120,
          right: 120,
          fontSize: 17,
          fontWeight: fontWeights.regular,
          color: colors.textMuted,
          opacity: disclaimerOpacity,
          lineHeight: 1.55,
          textAlign: 'center',
        }}
      >
        {feeDragConfig.disclaimer}
      </div>
    </AbsoluteFill>
  );
};
