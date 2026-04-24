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
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 40,
                fontWeight: fontWeights.semibold,
                color: '#FFFFFF',
                background: '#0A0E14',                  // 100% opaque — covers Riverside burnt-in captions
                padding: '18px 40px',
                borderRadius: 10,
                minWidth: 700,                           // wide enough to cover typical source caption
                maxWidth: 1720,
                textAlign: 'center',
                lineHeight: 1.28,
                letterSpacing: 0.2,
                boxShadow: '0 6px 26px rgba(0, 0, 0, 0.5)',
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
