import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';
import { computeYearlyBalances, formatMillions } from '../compute';

export const YearThirtyReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { endA, endB } = computeYearlyBalances(feeDragConfig);

  const aEnter = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 110 } });
  const bEnter = spring({ frame: frame - 45, fps, config: { damping: 14, stiffness: 110 } });

  const aOpacity = interpolate(aEnter, [0, 1], [0, 1]);
  const aTranslate = interpolate(aEnter, [0, 1], [30, 0]);
  const bOpacity = interpolate(bEnter, [0, 1], [0, 1]);
  const bTranslate = interpolate(bEnter, [0, 1], [30, 0]);

  const Col: React.FC<{
    label: string;
    value: string;
    color: string;
    opacity: number;
    translate: number;
  }> = ({ label, value, color, opacity, translate }) => (
    <div style={{ opacity, transform: `translateY(${translate}px)`, textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: fontWeights.medium, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 24 }}>
        {label}
      </div>
      <div style={{ fontSize: 200, fontWeight: fontWeights.black, fontFamily: fonts.tabular, color, letterSpacing: -4 }}>
        {value}
      </div>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 40, color: colors.textMuted, marginBottom: 60, letterSpacing: 4, textTransform: 'uppercase' }}>
        After 30 years
      </div>
      <div style={{ display: 'flex', gap: 180 }}>
        <Col label="Advisor A" value={formatMillions(endA)} color={colors.advisorA} opacity={aOpacity} translate={aTranslate} />
        <Col label="ArcVest" value={formatMillions(endB)} color={colors.arcvest} opacity={bOpacity} translate={bTranslate} />
      </div>
    </AbsoluteFill>
  );
};
