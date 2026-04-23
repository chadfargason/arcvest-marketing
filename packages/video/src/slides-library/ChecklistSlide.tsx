import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Item {
  title: string;
  detail?: string;
}

interface Props {
  heading: string;
  items: Item[];
  framesBetweenItems?: number;
}

export const ChecklistSlide: React.FC<Props> = ({ heading, items, framesBetweenItems = 24 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingEnter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const headingOpacity = interpolate(headingEnter, [0, 1], [0, 1]);
  const headingTranslate = interpolate(headingEnter, [0, 1], [16, 0]);

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
          fontSize: 68,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -1,
          textAlign: 'center',
          maxWidth: 1600,
          lineHeight: 1.15,
          marginBottom: 70,
          opacity: headingOpacity,
          transform: `translateY(${headingTranslate}px)`,
        }}
      >
        {heading}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, width: 1400 }}>
        {items.map((item, i) => {
          const appearFrame = 12 + (i + 1) * framesBetweenItems;
          const itemEnter = spring({ frame: frame - appearFrame, fps, config: { damping: 14, stiffness: 110 } });
          const opacity = interpolate(itemEnter, [0, 1], [0, 1]);
          const translateX = interpolate(itemEnter, [0, 1], [30, 0]);

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 32,
                opacity,
                transform: `translateX(${translateX}px)`,
              }}
            >
              <div
                style={{
                  minWidth: 74,
                  height: 74,
                  borderRadius: '50%',
                  background: colors.arcvest,
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 38,
                  fontWeight: fontWeights.black,
                  fontFamily: fonts.tabular,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: fontWeights.semibold,
                    color: colors.textPrimary,
                    lineHeight: 1.25,
                  }}
                >
                  {item.title}
                </div>
                {item.detail && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 28,
                      fontWeight: fontWeights.regular,
                      color: colors.textMuted,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.detail}
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
