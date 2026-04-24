import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FeeDragVideo } from './fee-drag/FeeDragVideo';
import { feeDragConfig } from './fee-drag/config';
import { EpisodeVideo as NoFreeLunchVideo } from './episodes/2026-04-13-no-free-lunch/EpisodeVideo';
import { episodeConfig as noFreeLunchConfig } from './episodes/2026-04-13-no-free-lunch/config';
import { EpisodeVideo as FiveDecisionsVideo } from './episodes/2026-04-21-five-retirement-decisions/EpisodeVideo';
import { episodeConfig as fiveDecisionsConfig } from './episodes/2026-04-21-five-retirement-decisions/config';

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
        component={NoFreeLunchVideo}
        durationInFrames={Math.round(noFreeLunchConfig.durationSec * noFreeLunchConfig.fps)}
        fps={noFreeLunchConfig.fps}
        width={noFreeLunchConfig.widthPx}
        height={noFreeLunchConfig.heightPx}
      />
      <Composition
        id="FiveDecisions"
        component={FiveDecisionsVideo}
        durationInFrames={Math.round(fiveDecisionsConfig.durationSec * fiveDecisionsConfig.fps)}
        fps={fiveDecisionsConfig.fps}
        width={fiveDecisionsConfig.widthPx}
        height={fiveDecisionsConfig.heightPx}
      />
    </>
  );
};

registerRoot(RemotionRoot);
