import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  url: string;
  tagline: string;
  disclaimer: string;
}

export const OutroSlide: React.FC<Props> = ({ url, tagline, disclaimer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.85, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const urlOpacity = interpolate(frame, [10, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglinePulse = spring({ frame: frame - 22, fps, config: { damping: 11, stiffness: 130 } });
  const taglineScale = interpolate(taglinePulse, [0, 1], [0.82, 1]);
  const taglineOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const disclaimerOpacity = interpolate(frame, [36, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fonts.sans }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '58%',                // shrunk from 70% to make room for disclaimer above caption zone
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
            marginTop: 22,
            fontSize: 44,
            fontWeight: fontWeights.semibold,
            color: colors.textPrimary,
            opacity: urlOpacity,
            letterSpacing: 1,
          }}
        >
          {url}
        </div>
        <div
          style={{
            marginTop: 34,
            fontSize: 60,
            fontWeight: fontWeights.black,
            color: colors.gap,
            letterSpacing: -1,
            opacity: taglineOpacity,
            transform: `scale(${taglineScale})`,
          }}
        >
          {tagline}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '60%',                  // moved up from 72% so disclaimer ends well above caption pill
          left: 100,
          right: 100,
          bottom: 170,                  // ends ~170px above frame bottom (above caption zone)
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
        {disclaimer}
      </div>
    </AbsoluteFill>
  );
};
