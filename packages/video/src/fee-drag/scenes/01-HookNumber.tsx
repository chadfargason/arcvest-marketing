import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';

// VO 1 timeline (220 frames total):
//   f0–~75    "Today, we're discussing investment advisory fees"
//   f79–f200  "Over a lifetime of investing, a 1% fee can cost you over $1M"
// Visual: intro title card for the first sentence, then the $1.17M digit build
// lands as the second sentence plays.

const GLYPHS = ['$', '1', '.', '1', '7', 'M'];
const TITLE_IN = 5;
const TITLE_OUT = 70;
const FIRST_GLYPH_FRAME = 75;
const FRAMES_PER_GLYPH = 10;

export const HookNumber: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [TITLE_IN, TITLE_IN + 10, TITLE_OUT, TITLE_OUT + 10], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
      {frame < TITLE_OUT + 12 && (
        <div
          style={{
            position: 'absolute',
            fontFamily: fonts.sans,
            fontSize: 92,
            fontWeight: fontWeights.bold,
            color: colors.textPrimary,
            letterSpacing: -1,
            opacity: titleOpacity,
            textAlign: 'center',
            maxWidth: 1400,
            lineHeight: 1.15,
          }}
        >
          Investment Advisory Fees
        </div>
      )}

      {frame >= FIRST_GLYPH_FRAME && (
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
      )}
    </AbsoluteFill>
  );
};
