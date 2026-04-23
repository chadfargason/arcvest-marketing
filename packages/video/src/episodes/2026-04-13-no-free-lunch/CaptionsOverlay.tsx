import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { buildCaptions, type CaptionSegment } from './transcript-captions';

interface Props {
  // Frame ranges where captions should be suppressed (e.g. text-heavy slides
  // whose on-screen copy already carries the message).
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
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 40,
                fontWeight: fontWeights.semibold,
                color: '#FFFFFF',
                background: 'rgba(10, 14, 20, 0.95)',
                padding: '14px 34px',
                borderRadius: 10,
                maxWidth: 1600,
                textAlign: 'center',
                lineHeight: 1.28,
                letterSpacing: 0.2,
                boxShadow: '0 6px 26px rgba(0, 0, 0, 0.35)',
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
