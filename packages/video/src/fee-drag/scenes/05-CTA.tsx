import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

// VO alignments (vo-5-cta.json), scene-relative:
//   "arcvest dot com"      → f14
//   "pay less, keep more"  → f129
// Scene duration 214 frames (7.1s)
const URL_APPEAR_FRAME = 11;
const TAGLINE_APPEAR_FRAME = 120;
const DISCLAIMER_APPEAR_FRAME = 45;

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
  const taglineScale = interpolate(taglinePulse, [0, 1], [0.82, 1]);
  const taglineOpacity = interpolate(frame, [TAGLINE_APPEAR_FRAME, TAGLINE_APPEAR_FRAME + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const disclaimerOpacity = interpolate(frame, [DISCLAIMER_APPEAR_FRAME, DISCLAIMER_APPEAR_FRAME + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
      }}
    >
      {/* Top 70% holds the brand content, flex-centered */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '70%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 60,
        }}
      >
        <div
          style={{
            fontSize: 160,
            fontWeight: fontWeights.black,
            color: colors.arcvest,
            letterSpacing: -5,
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            lineHeight: 1,
          }}
        >
          ArcVest
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 46,
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
            marginTop: 32,
            fontSize: 64,
            fontWeight: fontWeights.black,
            color: colors.gap,
            letterSpacing: -1,
            opacity: taglineOpacity,
            transform: `scale(${taglineScale})`,
            lineHeight: 1,
          }}
        >
          {feeDragConfig.cta.tagline}
        </div>
      </div>

      {/* Bottom area holds the disclaimer — physically separated from content */}
      <div
        style={{
          position: 'absolute',
          top: '72%',
          left: 100,
          right: 100,
          bottom: 30,
          fontSize: 15,
          fontWeight: fontWeights.regular,
          color: colors.textMuted,
          opacity: disclaimerOpacity,
          lineHeight: 1.5,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {feeDragConfig.disclaimer}
      </div>
    </AbsoluteFill>
  );
};
