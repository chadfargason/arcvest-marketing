import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

export interface TableRow {
  cells: string[];
  emphasis?: boolean;
}

interface Props {
  kicker?: string;
  heading: string;
  columns: string[];
  rows: TableRow[];
  footer?: string;
  framesBetween?: number;
}

const Row: React.FC<{
  row: TableRow;
  appearAtFrame: number;
  gridTemplate: string;
  rowIndex: number;
}> = ({ row, appearAtFrame, gridTemplate, rowIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - appearAtFrame,
    fps,
    config: { damping: 14, stiffness: 110 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translateY = interpolate(enter, [0, 1], [12, 0]);

  const bg = row.emphasis
    ? 'rgba(37, 99, 235, 0.10)'
    : rowIndex % 2 === 0
      ? colors.bgCard
      : 'rgba(0, 0, 0, 0.025)';
  const border = row.emphasis ? colors.arcvest : colors.divider;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        gap: 20,
        padding: '22px 36px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        marginBottom: 8,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {row.cells.map((cell, i) => (
        <div
          key={i}
          style={{
            fontSize: 30,
            fontWeight: row.emphasis
              ? (i === 0 ? fontWeights.bold : fontWeights.black)
              : (i === 0 ? fontWeights.semibold : fontWeights.medium),
            color: row.emphasis
              ? (i === 0 ? colors.textPrimary : colors.arcvest)
              : (i === 0 ? colors.textPrimary : colors.textSecondary),
            fontFamily: i === 0 ? fonts.sans : fonts.tabular,
            letterSpacing: i === 0 ? 0 : -0.3,
            lineHeight: 1.3,
          }}
        >
          {cell}
        </div>
      ))}
    </div>
  );
};

export const TableSlide: React.FC<Props> = ({
  kicker,
  heading,
  columns,
  rows,
  footer,
  framesBetween = 16,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const kickerOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const headingEnter = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 100 } });
  const headingOpacity = interpolate(headingEnter, [0, 1], [0, 1]);

  const headerAppears = 22;
  const headerOpacity = interpolate(frame, [headerAppears, headerAppears + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const firstRowAppears = headerAppears + 14;
  const footerAppears = firstRowAppears + rows.length * framesBetween + 10;
  const footerOpacity = interpolate(frame, [footerAppears, footerAppears + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Grid template: first column (label) is wider, remaining columns share equal width
  const gridTemplate =
    columns.length === 2
      ? '1.3fr 1fr'
      : columns.length === 3
        ? '1.3fr 1fr 1fr'
        : Array(columns.length).fill('1fr').join(' ');

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        padding: '70px 140px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {kicker && (
        <div
          style={{
            fontSize: 24,
            fontWeight: fontWeights.semibold,
            color: colors.arcvest,
            letterSpacing: 5,
            textTransform: 'uppercase',
            marginBottom: 14,
            opacity: kickerOpacity,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontSize: 60,
          fontWeight: fontWeights.black,
          color: colors.textPrimary,
          letterSpacing: -1,
          lineHeight: 1.12,
          marginBottom: 36,
          maxWidth: 1600,
          opacity: headingOpacity,
        }}
      >
        {heading}
      </div>

      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: 20,
          padding: '0 36px 14px 36px',
          borderBottom: `2px solid ${colors.textSecondary}`,
          marginBottom: 12,
          opacity: headerOpacity,
        }}
      >
        {columns.map((col, i) => (
          <div
            key={i}
            style={{
              fontSize: 22,
              fontWeight: fontWeights.bold,
              color: colors.textMuted,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {col}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {rows.map((row, i) => (
          <Row
            key={i}
            row={row}
            appearAtFrame={firstRowAppears + i * framesBetween}
            gridTemplate={gridTemplate}
            rowIndex={i}
          />
        ))}
      </div>

      {footer && (
        <div
          style={{
            marginTop: 16,
            fontSize: 24,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            textAlign: 'center',
            opacity: footerOpacity,
          }}
        >
          {footer}
        </div>
      )}
    </AbsoluteFill>
  );
};
