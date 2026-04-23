import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors } from '../brand/colors';

interface Props {
  /** Frame within the SOURCE MP4 where the PIP video should start playing. */
  pipStartFrame: number;
  /** Relative path under public/ for the source video. */
  sourceVideo: string;
  /** Corner to place the PIP in. */
  corner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Width of the PIP rectangle in pixels. Height is computed 16:9. */
  width?: number;
  /** The main slide content to render underneath the PIP. */
  children: React.ReactNode;
}

export const SlideWithPip: React.FC<Props> = ({
  pipStartFrame,
  sourceVideo,
  corner = 'top-right',
  width = 480,
  children,
}) => {
  const frame = useCurrentFrame();
  const height = Math.round((width * 9) / 16);
  const margin = 60;

  const positionStyle: React.CSSProperties = (() => {
    switch (corner) {
      case 'top-left':
        return { top: margin, left: margin };
      case 'bottom-right':
        return { bottom: margin, right: margin };
      case 'bottom-left':
        return { bottom: margin, left: margin };
      case 'top-right':
      default:
        return { top: margin, right: margin };
    }
  })();

  const enterOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {children}
      <div
        style={{
          position: 'absolute',
          ...positionStyle,
          width,
          height,
          borderRadius: 24,
          overflow: 'hidden',
          border: `4px solid ${colors.arcvest}`,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.22)',
          opacity: enterOpacity,
          background: '#000',
        }}
      >
        <OffthreadVideo
          src={staticFile(sourceVideo)}
          startFrom={pipStartFrame}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </AbsoluteFill>
  );
};
