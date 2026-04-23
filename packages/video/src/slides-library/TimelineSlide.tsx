import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Event {
  date: string;
  title: string;
  detail?: string;
}

interface Props {
  heading: string;
  events: Event[];
  framesBetween?: number;
}

export const TimelineSlide: React.FC<Props> = ({ heading, events, framesBetween = 22 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingEnter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const headingOpacity = interpolate(headingEnter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        padding: '100px 160px',
      }}
    >
      <div
        style={{
          fontSize: 54,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -1,
          marginBottom: 50,
          opacity: headingOpacity,
        }}
      >
        {heading}
      </div>

      <div style={{ position: 'relative', flex: 1 }}>
        {/* Vertical rail */}
        <div
          style={{
            position: 'absolute',
            left: 190,
            top: 10,
            bottom: 10,
            width: 4,
            background: colors.gridLine,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 190,
            top: 10,
            width: 4,
            background: colors.gap,
            borderRadius: 2,
            height: interpolate(
              frame,
              [15, 15 + events.length * framesBetween + 30],
              [0, 730],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            ),
          }}
        />

        {events.map((evt, i) => {
          const appearFrame = 14 + (i + 1) * framesBetween;
          const itemEnter = spring({ frame: frame - appearFrame, fps, config: { damping: 14, stiffness: 110 } });
          const opacity = interpolate(itemEnter, [0, 1], [0, 1]);
          const translateX = interpolate(itemEnter, [0, 1], [20, 0]);

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: 38,
                opacity,
                transform: `translateX(${translateX}px)`,
              }}
            >
              <div
                style={{
                  width: 178,
                  fontSize: 30,
                  fontWeight: fontWeights.bold,
                  color: colors.gap,
                  fontFamily: fonts.tabular,
                  paddingTop: 10,
                }}
              >
                {evt.date}
              </div>
              <div
                style={{
                  position: 'relative',
                  marginLeft: 4,
                  marginRight: 34,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: colors.gap,
                  border: `4px solid ${colors.bg}`,
                  marginTop: 14,
                  boxShadow: `0 0 0 4px ${colors.gap}`,
                  zIndex: 1,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: fontWeights.semibold,
                    color: colors.textPrimary,
                    lineHeight: 1.2,
                  }}
                >
                  {evt.title}
                </div>
                {evt.detail && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 26,
                      fontWeight: fontWeights.regular,
                      color: colors.textMuted,
                      lineHeight: 1.3,
                    }}
                  >
                    {evt.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
