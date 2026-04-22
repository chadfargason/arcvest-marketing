import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatLongDollars } from '../compute';

// Long-form digit reveal of "$1,170,000" — the payoff number.
// Box morphs in (echoing the chart's gap fill), then digits cascade.
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { gap, extraYears } = computeYearlyBalances(feeDragConfig);
  // Round the gap to the cleanest hero number ($1,170,000)
  const heroValue = Math.round(gap / 10_000) * 10_000;
  const text = formatLongDollars(heroValue);

  const boxEnter = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 90 } });
  const boxScale = interpolate(boxEnter, [0, 1], [0.6, 1]);
  const boxOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  const FIRST_GLYPH_FRAME = 35;
  const FRAMES_PER_GLYPH = 9;
  const yearsRounded = Math.round(extraYears);

  const translationOpacity = interpolate(
    frame,
    [FIRST_GLYPH_FRAME + text.length * FRAMES_PER_GLYPH + 20, FIRST_GLYPH_FRAME + text.length * FRAMES_PER_GLYPH + 50],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const goneOpacity = interpolate(
    frame,
    [FIRST_GLYPH_FRAME + text.length * FRAMES_PER_GLYPH + 80, FIRST_GLYPH_FRAME + text.length * FRAMES_PER_GLYPH + 110],
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
      }}
    >
      <div
        style={{
          padding: '70px 120px',
          background: colors.gapFillStrong,
          border: `4px solid ${colors.gap}`,
          borderRadius: 24,
          transform: `scale(${boxScale})`,
          opacity: boxOpacity,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 200,
            fontWeight: fontWeights.black,
            color: colors.textPrimary,
            fontFamily: fonts.tabular,
            letterSpacing: -4,
            lineHeight: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {text.split('').map((g, i) => {
            const start = FIRST_GLYPH_FRAME + i * FRAMES_PER_GLYPH;
            const op = interpolate(frame, [start, start + 6], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const ty = interpolate(frame, [start, start + 12], [-20, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <span key={i} style={{ opacity: op, transform: `translateY(${ty}px)`, display: 'inline-block' }}>
                {g}
              </span>
            );
          })}
        </div>
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: 44,
          color: colors.textSecondary,
          opacity: translationOpacity,
          textAlign: 'center',
        }}
      >
        about <span style={{ color: colors.textPrimary, fontWeight: fontWeights.bold }}>{yearsRounded} extra years</span> of retirement at $300K/year
      </div>
      <div
        style={{
          marginTop: 26,
          fontSize: 38,
          fontWeight: fontWeights.semibold,
          color: colors.gap,
          opacity: goneOpacity,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        Gone — to fees
      </div>
    </AbsoluteFill>
  );
};
