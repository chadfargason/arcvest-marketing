import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FeeDragVideo } from './fee-drag/FeeDragVideo';
import { feeDragConfig } from './fee-drag/config';

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FeeDrag"
        component={FeeDragVideo}
        durationInFrames={feeDragConfig.video.durationFrames}
        fps={feeDragConfig.video.fps}
        width={feeDragConfig.video.width}
        height={feeDragConfig.video.height}
      />
    </>
  );
};

registerRoot(RemotionRoot);
