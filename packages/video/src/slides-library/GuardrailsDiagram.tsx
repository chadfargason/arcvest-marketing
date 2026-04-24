import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

interface Props {
  initialRate: number;       // 0.05 (= 5%)
  triggerThreshold: number;  // 0.20 (= 20% deviation)
  adjustment: number;        // 0.10 (= 10% withdrawal change on trigger)
  notes: string[];           // ["Inflation: adjusted annually, except after a cut", "Suspended when ≤15-yr horizon"]
}

// Vertical thermometer showing the Guyton-Klinger guardrails. Rate on y-axis;
// above the 'lower guardrail' (high withdrawal rate) is the CUT zone; below the
// 'upper guardrail' (low withdrawal rate) is the RAISE zone.
export const GuardrailsDiagram: React.FC<Props> = ({
  initialRate,
  triggerThreshold,
  adjustment,
  notes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lowerRate = initialRate * (1 + triggerThreshold); // e.g. 6.0%
  const upperRate = initialRate * (1 - triggerThreshold); // e.g. 4.0%

  // Display range on the chart axis (give 1 percentage point of headroom)
  const yMin = upperRate - 0.01;
  const yMax = lowerRate + 0.01;
  const yToPercent = (rate: number): number =>
    ((rate - yMin) / (yMax - yMin)) * 100;

  // Layout
  const CHART = { x: 200, y: 230, width: 900, height: 660 };
  const yPos = (rate: number): number =>
    CHART.y + CHART.height - (CHART.height * (rate - yMin)) / (yMax - yMin);

  // Animation timings
  const headingEnter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const headingOpacity = interpolate(headingEnter, [0, 1], [0, 1]);
  const subheadingOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: 'clamp' });

  const chartFrameOpacity = interpolate(frame, [22, 40], [0, 1], { extrapolateRight: 'clamp' });
  const initialLineOpacity = interpolate(frame, [40, 58], [0, 1], { extrapolateRight: 'clamp' });
  const lowerLineOpacity = interpolate(frame, [60, 78], [0, 1], { extrapolateRight: 'clamp' });
  const upperLineOpacity = interpolate(frame, [80, 98], [0, 1], { extrapolateRight: 'clamp' });
  const cutZoneOpacity = interpolate(frame, [102, 124], [0, 1], { extrapolateRight: 'clamp' });
  const raiseZoneOpacity = interpolate(frame, [128, 150], [0, 1], { extrapolateRight: 'clamp' });

  const fmt = (r: number): string => `${(r * 100).toFixed(1)}%`;
  const adj = `${(adjustment * 100).toFixed(0)}%`;

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        padding: '60px 100px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: fontWeights.semibold,
            color: colors.arcvest,
            letterSpacing: 5,
            textTransform: 'uppercase',
            marginBottom: 12,
            opacity: subheadingOpacity,
          }}
        >
          Guyton-Klinger Framework
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: fontWeights.black,
            color: colors.textPrimary,
            letterSpacing: -1,
            lineHeight: 1.1,
            marginBottom: 30,
            opacity: headingOpacity,
          }}
        >
          The Guardrails Approach
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'flex-start' }}>
        {/* Left: thermometer SVG */}
        <svg width={1100} height={760} style={{ display: 'block' }}>
          {/* Chart frame */}
          <rect
            x={CHART.x}
            y={CHART.y}
            width={CHART.width}
            height={CHART.height}
            fill="none"
            stroke={colors.divider}
            strokeWidth={2}
            rx={12}
            style={{ opacity: chartFrameOpacity }}
          />

          {/* CUT zone (red) — above lower guardrail */}
          <rect
            x={CHART.x}
            y={CHART.y}
            width={CHART.width}
            height={yPos(lowerRate) - CHART.y}
            fill={colors.gap}
            opacity={cutZoneOpacity * 0.16}
          />

          {/* RAISE zone (blue) — below upper guardrail */}
          <rect
            x={CHART.x}
            y={yPos(upperRate)}
            width={CHART.width}
            height={CHART.y + CHART.height - yPos(upperRate)}
            fill={colors.arcvest}
            opacity={raiseZoneOpacity * 0.16}
          />

          {/* Lower guardrail — top dashed line */}
          <g style={{ opacity: lowerLineOpacity }}>
            <line
              x1={CHART.x + 20}
              x2={CHART.x + CHART.width - 20}
              y1={yPos(lowerRate)}
              y2={yPos(lowerRate)}
              stroke={colors.gap}
              strokeWidth={4}
              strokeDasharray="14,8"
            />
            <text
              x={CHART.x + 36}
              y={yPos(lowerRate) - 18}
              fill={colors.gap}
              fontSize={26}
              fontFamily="Arial, sans-serif"
              fontWeight={800}
              letterSpacing={2}
            >
              LOWER GUARDRAIL · {fmt(lowerRate)}
            </text>
            <text
              x={CHART.x + 36}
              y={yPos(lowerRate) + 36}
              fill={colors.gap}
              fontSize={22}
              fontFamily="Arial, sans-serif"
              fontWeight={600}
            >
              ↑ Withdrawal rate too high → cut spending {adj}
            </text>
          </g>

          {/* Initial rate — middle solid line */}
          <g style={{ opacity: initialLineOpacity }}>
            <line
              x1={CHART.x + 20}
              x2={CHART.x + CHART.width - 20}
              y1={yPos(initialRate)}
              y2={yPos(initialRate)}
              stroke={colors.textPrimary}
              strokeWidth={5}
            />
            <text
              x={CHART.x + 36}
              y={yPos(initialRate) - 16}
              fill={colors.textPrimary}
              fontSize={28}
              fontFamily="Arial, sans-serif"
              fontWeight={900}
              letterSpacing={2}
            >
              INITIAL RATE · {fmt(initialRate)}
            </text>
          </g>

          {/* Upper guardrail — bottom dashed line */}
          <g style={{ opacity: upperLineOpacity }}>
            <line
              x1={CHART.x + 20}
              x2={CHART.x + CHART.width - 20}
              y1={yPos(upperRate)}
              y2={yPos(upperRate)}
              stroke={colors.arcvest}
              strokeWidth={4}
              strokeDasharray="14,8"
            />
            <text
              x={CHART.x + 36}
              y={yPos(upperRate) + 36}
              fill={colors.arcvest}
              fontSize={26}
              fontFamily="Arial, sans-serif"
              fontWeight={800}
              letterSpacing={2}
            >
              UPPER GUARDRAIL · {fmt(upperRate)}
            </text>
            <text
              x={CHART.x + 36}
              y={yPos(upperRate) + 70}
              fill={colors.arcvest}
              fontSize={22}
              fontFamily="Arial, sans-serif"
              fontWeight={600}
            >
              ↓ Withdrawal rate too low → raise spending {adj}
            </text>
          </g>

          {/* Y-axis label */}
          <text
            x={CHART.x - 24}
            y={CHART.y - 18}
            fill={colors.textMuted}
            fontSize={20}
            fontFamily="Arial, sans-serif"
            fontWeight={600}
            letterSpacing={2}
            textAnchor="start"
          >
            CURRENT WITHDRAWAL RATE
          </text>
        </svg>

        {/* Right: rule notes */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            paddingLeft: 50,
            paddingTop: 80,
          }}
        >
          {notes.map((note, i) => {
            const appearAt = 152 + i * 20;
            const enter = spring({
              frame: frame - appearAt,
              fps,
              config: { damping: 14, stiffness: 110 },
            });
            const opacity = interpolate(enter, [0, 1], [0, 1]);
            const translateX = interpolate(enter, [0, 1], [16, 0]);
            return (
              <div
                key={i}
                style={{
                  padding: '20px 26px',
                  background: colors.bgCard,
                  border: `2px solid ${colors.divider}`,
                  borderRadius: 12,
                  fontSize: 26,
                  fontWeight: fontWeights.medium,
                  color: colors.textSecondary,
                  lineHeight: 1.32,
                  opacity,
                  transform: `translateX(${translateX}px)`,
                }}
              >
                {note}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
