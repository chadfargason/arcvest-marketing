import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { feeDragConfig } from '../config';

const Row: React.FC<{
  label: string;
  advisory: string;
  product: string;
  total: string;
  color: string;
  rowIndex: number;
}> = ({ label, advisory, product, total, color, rowIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - 20 - rowIndex * 15,
    fps,
    config: { damping: 16, stiffness: 100 },
  });
  const translateX = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 180px 60px 180px 60px 180px',
        alignItems: 'center',
        columnGap: 24,
        padding: '20px 0',
        borderBottom: `1px solid ${colors.gridLine}`,
        fontSize: 44,
        fontFamily: fonts.tabular,
        color,
        transform: `translateX(${translateX}px)`,
        opacity,
      }}
    >
      <div style={{ fontWeight: fontWeights.semibold }}>{label}</div>
      <div style={{ textAlign: 'right' }}>{advisory}</div>
      <div style={{ color: colors.textMuted, textAlign: 'center' }}>+</div>
      <div style={{ textAlign: 'right' }}>{product}</div>
      <div style={{ color: colors.textMuted, textAlign: 'center' }}>=</div>
      <div style={{ textAlign: 'right', fontWeight: fontWeights.bold }}>{total}</div>
    </div>
  );
};

export const FeeBreakdown: React.FC = () => {
  const { advisorA, advisorB } = feeDragConfig;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        color: colors.textPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div style={{ width: 1100 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 180px 60px 180px 60px 180px',
            columnGap: 24,
            fontSize: 26,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          <div></div>
          <div style={{ textAlign: 'right' }}>Advisory</div>
          <div></div>
          <div style={{ textAlign: 'right' }}>Product</div>
          <div></div>
          <div style={{ textAlign: 'right' }}>All-In</div>
        </div>
        <Row
          label={advisorA.label}
          advisory={pct(advisorA.advisoryFee)}
          product={pct(advisorA.productCost)}
          total={pct(advisorA.totalFee)}
          color={colors.advisorA}
          rowIndex={0}
        />
        <Row
          label={advisorB.label}
          advisory={pct(advisorB.advisoryFee)}
          product={pct(advisorB.productCost)}
          total={pct(advisorB.totalFee)}
          color={colors.arcvest}
          rowIndex={1}
        />
      </div>
    </AbsoluteFill>
  );
};
