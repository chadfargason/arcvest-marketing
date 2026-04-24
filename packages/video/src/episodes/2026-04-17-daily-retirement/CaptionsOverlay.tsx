import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { fonts, fontWeights } from '../../brand/fonts';
import { buildCaptions, type CaptionSegment } from './transcript-captions';

interface Props {
  suppressedFrameRanges?: Array<[number, number]>;
}

function isSuppressed(caption: CaptionSegment, ranges: Array<[number, number]> | undefined): boolean {
  if (!ranges || ranges.length === 0) return false;
  const midFrame = caption.fromFrame + caption.durationFrames / 2;
  return ranges.some(([start, end]) => midFrame >= start && midFrame < end);
}

export const CaptionsOverlay: React.FC<Props> = ({ suppressedFrameRanges }) => {
  const { fps } = useVideoConfig();
  const captions = React.useMemo(() => buildCaptions(fps), [fps]);
  const visible = React.useMemo(
    () => captions.filter((c) => !isSuppressed(c, suppressedFrameRanges)),
    [captions, suppressedFrameRanges],
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {visible.map((c, i) => (
        <Sequence key={i} from={c.fromFrame} durationInFrames={c.durationFrames}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 34 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 48,
                fontWeight: fontWeights.semibold,
                color: '#FFFFFF',
                background: '#0A0E14',
                padding: '22px 50px',
                borderRadius: 12,
                width: 1760,
                boxSizing: 'border-box',
                textAlign: 'center',
                lineHeight: 1.26,
                letterSpacing: 0.3,
                boxShadow: '0 8px 28px rgba(0, 0, 0, 0.55)',
              }}
            >
              {c.text}
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
