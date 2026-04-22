import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatMillions } from '../compute';

export const GapCallout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { gap } = computeYearlyBalances(feeDragConfig);

  const pulse = spring({ frame: frame - 5, fps, config: { damping: 10, stiffness: 80 } });
  const scale = interpolate(pulse, [0, 1], [0.6, 1]);
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  const labelOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${colors.bg} 0%, ${colors.bgVignette} 100%)`,
        fontFamily: fonts.sans,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          padding: '60px 120px',
          background: colors.gapFill,
          border: `4px solid ${colors.gap}`,
          borderRadius: 24,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div style={{ fontSize: 260, fontWeight: fontWeights.black, color: colors.textPrimary, fontFamily: fonts.tabular, letterSpacing: -6, lineHeight: 1 }}>
          {formatMillions(gap)}
        </div>
        <div style={{ fontSize: 44, fontWeight: fontWeights.bold, color: colors.gap, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center', marginTop: 20 }}>
          difference
        </div>
      </div>
      <div style={{ marginTop: 60, fontSize: 38, color: colors.textSecondary, opacity: labelOpacity, textAlign: 'center', maxWidth: 1400 }}>
        going to someone else — not to you
      </div>
    </AbsoluteFill>
  );
};
