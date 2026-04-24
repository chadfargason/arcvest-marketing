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

// New convention (episode 2 forward): captions play over BOTH live video AND slides.
// The pill is large and fully opaque so it fully covers any Riverside burnt-in captions.
// Slides are built knowing the bottom ~130px is caption territory.
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
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 22 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 48,
                fontWeight: fontWeights.semibold,
                color: '#FFFFFF',
                background: '#0A0E14',             // 100% opaque — covers Riverside burnt-in
                padding: '22px 50px',
                borderRadius: 12,
                minWidth: 860,                      // wide enough to cover source caption
                maxWidth: 1760,
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
