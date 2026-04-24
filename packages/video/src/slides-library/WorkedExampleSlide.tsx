import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';

export interface WorkedExampleStep {
  label: string;
  value: string;
  emphasis?: boolean; // bold / accent color
}

interface Props {
  kicker?: string;
  headline: string;
  setup?: string; // one-line scenario description
  steps: WorkedExampleStep[];
  outcome: { label: string; value: string };
  framesBetween?: number;
}

const StepRow: React.FC<{
  step: WorkedExampleStep;
  appearAtFrame: number;
}> = ({ step, appearAtFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - appearAtFrame,
    fps,
    config: { damping: 14, stiffness: 110 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translateX = interpolate(enter, [0, 1], [20, 0]);

  const valueColor = step.emphasis ? colors.arcvest : colors.textPrimary;
  const labelColor = step.emphasis ? colors.textPrimary : colors.textSecondary;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '22px 40px',
        background: step.emphasis ? 'rgba(37, 99, 235, 0.08)' : colors.bgCard,
        border: `1px solid ${step.emphasis ? colors.arcvest : colors.divider}`,
        borderRadius: 12,
        opacity,
        transform: `translateX(${translateX}px)`,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: step.emphasis ? fontWeights.bold : fontWeights.medium,
          color: labelColor,
          flex: 1,
          lineHeight: 1.2,
        }}
      >
        {step.label}
      </div>
      <div
        style={{
          fontSize: 44,
          fontWeight: fontWeights.black,
          fontFamily: fonts.tabular,
          color: valueColor,
          letterSpacing: -1,
          whiteSpace: 'nowrap',
          marginLeft: 40,
        }}
      >
        {step.value}
      </div>
    </div>
  );
};

export const WorkedExampleSlide: React.FC<Props> = ({
  kicker,
  headline,
  setup,
  steps,
  outcome,
  framesBetween = 18,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const kickerOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const headingEnter = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 100 } });
  const headingOpacity = interpolate(headingEnter, [0, 1], [0, 1]);
  const headingTranslate = interpolate(headingEnter, [0, 1], [14, 0]);

  const setupOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const firstStepAppears = 26;
  const outcomeAppears = firstStepAppears + steps.length * framesBetween + 14;
  const outcomeEnter = spring({
    frame: frame - outcomeAppears,
    fps,
    config: { damping: 12, stiffness: 110 },
  });
  const outcomeScale = interpolate(outcomeEnter, [0, 1], [0.92, 1]);
  const outcomeOpacity = interpolate(outcomeEnter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: fonts.sans,
        // bottom 160px reserved for caption pill — outcome row MUST sit above it
        padding: '70px 140px 160px 140px',
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
          maxWidth: 1600,
          opacity: headingOpacity,
          transform: `translateY(${headingTranslate}px)`,
        }}
      >
        {headline}
      </div>
      {setup && (
        <div
          style={{
            fontSize: 28,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            marginTop: 14,
            lineHeight: 1.3,
            opacity: setupOpacity,
          }}
        >
          {setup}
        </div>
      )}

      <div style={{ flex: 1, marginTop: 40 }}>
        {steps.map((step, i) => (
          <StepRow key={i} step={step} appearAtFrame={firstStepAppears + i * framesBetween} />
        ))}

        <div
          style={{
            marginTop: 26,
            padding: '30px 44px',
            background: colors.gap,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            opacity: outcomeOpacity,
            transform: `scale(${outcomeScale})`,
            transformOrigin: 'center',
            boxShadow: '0 10px 36px rgba(220, 38, 38, 0.22)',
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: fontWeights.semibold,
              color: '#FFFFFF',
              lineHeight: 1.2,
              flex: 1,
              letterSpacing: 0.5,
            }}
          >
            {outcome.label}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: fontWeights.black,
              fontFamily: fonts.tabular,
              color: '#FFFFFF',
              letterSpacing: -1,
              whiteSpace: 'nowrap',
              marginLeft: 40,
            }}
          >
            {outcome.value}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
