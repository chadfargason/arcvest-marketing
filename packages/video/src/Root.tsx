import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FeeDragVideo } from './fee-drag/FeeDragVideo';
import { feeDragConfig } from './fee-drag/config';
import { EpisodeVideo } from './episodes/2026-04-13-no-free-lunch/EpisodeVideo';
import { episodeConfig as noFreeLunchConfig } from './episodes/2026-04-13-no-free-lunch/config';

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
      <Composition
        id="NoFreeLunch"
        component={EpisodeVideo}
        durationInFrames={Math.round(noFreeLunchConfig.durationSec * noFreeLunchConfig.fps)}
        fps={noFreeLunchConfig.fps}
        width={noFreeLunchConfig.widthPx}
        height={noFreeLunchConfig.heightPx}
      />
    </>
  );
};

registerRoot(RemotionRoot);
