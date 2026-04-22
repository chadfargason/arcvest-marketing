import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

// VO alignments (vo-4-reveal.json), scene-relative:
//   "one-point-one-seven" begins at 0.43s   → frame 13  (digits cascade start)
//   "four percent rule"   begins at 10.18s  → frame 305
//   "beach house"         begins at 11.78s  → frame 353
const DIGITS_START_FRAME = 13;
const FRAMES_PER_GLYPH = 6;

// Rotating subtitles below the hero number, timed to VO beats
const SUBTITLES: ReadonlyArray<{ from: number; until: number; text: string; emphasis?: boolean }> = [
  { from: 60, until: 180, text: "Going to your advisor's retirement — not yours" },
  { from: 185, until: 348, text: '≈ 5 years of retirement income at the 4% rule' },
  { from: 350, until: 380, text: 'Or a beach house.', emphasis: true },
];

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = feeDragConfig.heroGapDisplay; // "$1,170,000" — locked literal

  const boxEnter = spring({ frame: frame - 0, fps, config: { damping: 12, stiffness: 90 } });
  const boxScale = interpolate(boxEnter, [0, 1], [0.55, 1]);
  const boxOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  const activeSubtitle = SUBTITLES.find((s) => frame >= s.from && frame < s.until);

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
          padding: '60px 120px',
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
            const start = DIGITS_START_FRAME + i * FRAMES_PER_GLYPH;
            const op = interpolate(frame, [start, start + 5], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const ty = interpolate(frame, [start, start + 10], [-18, 0], {
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

      {activeSubtitle && (
        <Subtitle key={activeSubtitle.from} from={activeSubtitle.from} text={activeSubtitle.text} emphasis={activeSubtitle.emphasis ?? false} />
      )}
    </AbsoluteFill>
  );
};

const Subtitle: React.FC<{ from: number; text: string; emphasis: boolean }> = ({ from, text, emphasis }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [from, from + 18], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        marginTop: 55,
        fontSize: emphasis ? 62 : 44,
        fontWeight: emphasis ? fontWeights.black : fontWeights.medium,
        color: emphasis ? colors.gap : colors.textSecondary,
        opacity,
        transform: `translateY(${translateY}px)`,
        textAlign: 'center',
        letterSpacing: emphasis ? 1 : 0,
      }}
    >
      {text}
    </div>
  );
};
