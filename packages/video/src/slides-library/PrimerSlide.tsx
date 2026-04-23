import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

export interface PrimerItem {
  label: string;
  detail: string;
  accent?: string; // optional short visual tag (e.g. "BDC" / "REIT" / "MLP")
}

interface Props {
  heading: string;
  kicker?: string;
  items: PrimerItem[];
  layout?: 'rows' | 'columns' | 'flow';
  footerNote?: string;
}

const ItemCard: React.FC<{ item: PrimerItem; appearAtFrame: number; layout: 'rows' | 'columns' | 'flow' }> = ({
  item,
  appearAtFrame,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - appearAtFrame, fps, config: { damping: 14, stiffness: 110 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translateY = interpolate(enter, [0, 1], [16, 0]);

  const isColumns = layout === 'columns';

  return (
    <div
      style={{
        flex: isColumns ? 1 : 'initial',
        padding: isColumns ? '40px 36px' : '26px 36px',
        background: colors.bgCard,
        border: `2px solid ${colors.divider}`,
        borderRadius: 18,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {item.accent && (
        <div
          style={{
            fontSize: 22,
            fontWeight: fontWeights.bold,
            color: colors.arcvest,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          {item.accent}
        </div>
      )}
      <div
        style={{
          fontSize: isColumns ? 44 : 36,
          fontWeight: fontWeights.bold,
          color: colors.textPrimary,
          lineHeight: 1.15,
          marginBottom: 10,
        }}
      >
        {item.label}
      </div>
      <div
        style={{
          fontSize: isColumns ? 26 : 24,
          fontWeight: fontWeights.regular,
          color: colors.textSecondary,
          lineHeight: 1.35,
        }}
      >
        {item.detail}
      </div>
    </div>
  );
};

export const PrimerSlide: React.FC<Props> = ({ heading, kicker, items, layout = 'rows', footerNote }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const kickerOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const headingEnter = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 100 } });
  const headingOpacity = interpolate(headingEnter, [0, 1], [0, 1]);
  const headingTranslate = interpolate(headingEnter, [0, 1], [16, 0]);

  const framesBetween = 18;
  const firstItemAppears = 24;
  const footerAppears = firstItemAppears + items.length * framesBetween + 12;

  const footerOpacity = interpolate(frame, [footerAppears, footerAppears + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        padding: '80px 120px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {kicker && (
        <div
          style={{
            fontSize: 26,
            fontWeight: fontWeights.semibold,
            color: colors.arcvest,
            letterSpacing: 5,
            textTransform: 'uppercase',
            marginBottom: 18,
            opacity: kickerOpacity,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontSize: 72,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -1,
          lineHeight: 1.1,
          marginBottom: 50,
          maxWidth: 1600,
          opacity: headingOpacity,
          transform: `translateY(${headingTranslate}px)`,
        }}
      >
        {heading}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: layout === 'columns' ? 'row' : 'column',
          gap: layout === 'columns' ? 40 : 20,
          alignItems: layout === 'columns' ? 'stretch' : 'stretch',
        }}
      >
        {items.map((item, i) => (
          <ItemCard key={i} item={item} appearAtFrame={firstItemAppears + i * framesBetween} layout={layout} />
        ))}
      </div>

      {footerNote && (
        <div
          style={{
            marginTop: 30,
            fontSize: 22,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            textAlign: 'center',
            opacity: footerOpacity,
          }}
        >
          {footerNote}
        </div>
      )}
    </AbsoluteFill>
  );
};
