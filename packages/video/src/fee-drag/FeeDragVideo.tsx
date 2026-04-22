import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { HookNumber } from './scenes/01-HookNumber';
import { FeeBreakdown } from './scenes/02-FeeBreakdown';
import { DualLineChart } from './scenes/03-DualLineChart';
import { YearThirtyReveal } from './scenes/04-YearThirtyReveal';
import { GapCallout } from './scenes/05-GapCallout';
import { CTA } from './scenes/06-CTA';
import { CaptionsOverlay } from './CaptionsOverlay';

const SCENE_DURATION = 150; // frames at 30fps = 5s

export const FeeDragVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <HookNumber />
      </Sequence>
      <Sequence from={1 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <FeeBreakdown />
      </Sequence>
      <Sequence from={2 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <DualLineChart />
      </Sequence>
      <Sequence from={3 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <YearThirtyReveal />
      </Sequence>
      <Sequence from={4 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <GapCallout />
      </Sequence>
      <Sequence from={5 * SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <CTA />
      </Sequence>
      <CaptionsOverlay />
      <Audio src={staticFile('vo.mp3')} />
    </AbsoluteFill>
  );
};
