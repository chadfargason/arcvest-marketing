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
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70 }}>
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 38,
                fontWeight: fontWeights.semibold,
                color: colors.textPrimary,
                background: colors.captionPill,
                border: `1px solid ${colors.captionPillBorder}`,
                padding: '14px 30px',
                borderRadius: 10,
                maxWidth: 1500,
                textAlign: 'center',
                lineHeight: 1.3,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
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
