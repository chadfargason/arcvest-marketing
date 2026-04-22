import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';

// Digit-by-digit build of "$1.17M".
// Each glyph reveals on a fixed frame schedule, then the whole number sits.
const GLYPHS = ['$', '1', '.', '1', '7', 'M'];
const FIRST_GLYPH_FRAME = 18;
const FRAMES_PER_GLYPH = 14;

export const HookNumber: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.tabular,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 320,
          fontWeight: fontWeights.black,
          letterSpacing: -10,
          display: 'flex',
          gap: 0,
          lineHeight: 1,
        }}
      >
        {GLYPHS.map((g, i) => {
          const start = FIRST_GLYPH_FRAME + i * FRAMES_PER_GLYPH;
          const opacity = interpolate(frame, [start, start + 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const translateY = interpolate(frame, [start, start + 10], [-20, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <span key={i} style={{ opacity, transform: `translateY(${translateY}px)`, display: 'inline-block' }}>
              {g}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
