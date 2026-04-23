import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { colors } from '../../brand/colors';
import { fonts, fontWeights } from '../../brand/fonts';
import { buildCaptions } from './transcript-captions';

export const CaptionsOverlay: React.FC = () => {
  const { fps } = useVideoConfig();
  const captions = React.useMemo(() => buildCaptions(fps), [fps]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {captions.map((c, i) => (
        <Sequence key={i} from={c.fromFrame} durationInFrames={c.durationFrames}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 46 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 30,
                fontWeight: fontWeights.semibold,
                color: '#FFFFFF',
                background: 'rgba(10, 14, 20, 0.88)',
                padding: '10px 22px',
                borderRadius: 8,
                maxWidth: 1500,
                textAlign: 'center',
                lineHeight: 1.3,
                letterSpacing: 0.2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
