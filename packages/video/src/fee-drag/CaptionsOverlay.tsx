import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { colors } from '../brand/colors';
import { fonts, fontWeights } from '../brand/fonts';
import { captions } from './captions';

export const CaptionsOverlay: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {captions.map((c, i) => (
        <Sequence key={i} from={c.fromFrame} durationInFrames={c.durationFrames}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 80 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 40,
                fontWeight: fontWeights.semibold,
                color: colors.textPrimary,
                background: 'rgba(10, 14, 20, 0.85)',
                padding: '14px 28px',
                borderRadius: 8,
                maxWidth: 1400,
                textAlign: 'center',
                lineHeight: 1.3,
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
