import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  showTitle: string;
  episodeTitle: string;
  hosts: string;
  date: string;
}

export const TitleSlide: React.FC<Props> = ({ showTitle, episodeTitle, hosts, date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleTranslate = interpolate(titleSpring, [0, 1], [20, 0]);

  const hostsOpacity = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dateOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '120px 120px 180px 120px',
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: fontWeights.semibold,
          color: colors.arcvest,
          letterSpacing: 5,
          textTransform: 'uppercase',
          marginBottom: 36,
          opacity: titleOpacity,
          transform: `translateY(${titleTranslate}px)`,
        }}
      >
        {showTitle}
      </div>
      <div
        style={{
          fontSize: 110,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -2,
          lineHeight: 1.05,
          textAlign: 'center',
          maxWidth: 1600,
          opacity: titleOpacity,
          transform: `translateY(${titleTranslate}px)`,
        }}
      >
        {episodeTitle}
      </div>
      <div
        style={{
          marginTop: 60,
          fontSize: 42,
          fontWeight: fontWeights.medium,
          color: colors.textSecondary,
          opacity: hostsOpacity,
        }}
      >
        {hosts}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 26,
          fontWeight: fontWeights.regular,
          color: colors.textMuted,
          letterSpacing: 2,
          textTransform: 'uppercase',
          opacity: dateOpacity,
        }}
      >
        {date}
      </div>
    </AbsoluteFill>
  );
};
