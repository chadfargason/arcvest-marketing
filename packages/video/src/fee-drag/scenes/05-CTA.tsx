import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

// VO alignments (vo-5-cta.json), scene-relative:
//   "arcvest dot com"       begins 0.35s  → frame 11
//   "pay less, keep more"   begins 3.43s  → frame 103
const URL_APPEAR_FRAME = 11;
const TAGLINE_APPEAR_FRAME = 103;
const DISCLAIMER_APPEAR_FRAME = 80;

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const logoScale = interpolate(logo, [0, 1], [0.85, 1]);
  const logoOpacity = interpolate(logo, [0, 1], [0, 1]);

  const urlOpacity = interpolate(frame, [URL_APPEAR_FRAME, URL_APPEAR_FRAME + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taglinePulse = spring({
    frame: frame - TAGLINE_APPEAR_FRAME,
    fps,
    config: { damping: 11, stiffness: 130 },
  });
  const taglineScale = interpolate(taglinePulse, [0, 1], [0.8, 1]);
  const taglineOpacity = interpolate(
    frame,
    [TAGLINE_APPEAR_FRAME, TAGLINE_APPEAR_FRAME + 14],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const disclaimerOpacity = interpolate(
    frame,
    [DISCLAIMER_APPEAR_FRAME, DISCLAIMER_APPEAR_FRAME + 30],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

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
          fontSize: 170,
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
          marginTop: 28,
          fontSize: 52,
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
          marginTop: 42,
          fontSize: 72,
          fontWeight: fontWeights.black,
          color: colors.gap,
          letterSpacing: -1,
          opacity: taglineOpacity,
          transform: `scale(${taglineScale})`,
        }}
      >
        {feeDragConfig.cta.tagline}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 120,
          right: 120,
          fontSize: 16,
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
