import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { HookNumber } from './scenes/01-HookNumber';
import { SplitScreen } from './scenes/02-SplitScreen';
import { DualLineChart } from './scenes/03-DualLineChart';
import { CTA } from './scenes/05-CTA';
import { CaptionsOverlay } from './CaptionsOverlay';
import { feeDragConfig } from './config';

const { hook, splitScreen, divergence, cta } = feeDragConfig.scenes;

// Within the merged divergence scene: VO 3 plays from scene start,
// VO 4 plays with a tiny 3-frame gap after VO 3 ends.
const VO3_DURATION_FRAMES = 612;
const VO3_TO_VO4_GAP_FRAMES = 3;
const VO4_START_IN_SCENE = VO3_DURATION_FRAMES + VO3_TO_VO4_GAP_FRAMES; // 615

export const FeeDragVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={hook.from} durationInFrames={hook.duration}>
        <HookNumber />
      </Sequence>
      <Sequence from={splitScreen.from} durationInFrames={splitScreen.duration}>
        <SplitScreen />
      </Sequence>
      <Sequence from={divergence.from} durationInFrames={divergence.duration}>
        <DualLineChart />
      </Sequence>
      <Sequence from={cta.from} durationInFrames={cta.duration}>
        <CTA />
      </Sequence>

      <CaptionsOverlay />

      <Sequence from={hook.from}>
        <Audio src={staticFile('vo-1-hook.mp3')} />
      </Sequence>
      <Sequence from={splitScreen.from}>
        <Audio src={staticFile('vo-2-setup.mp3')} />
      </Sequence>
      <Sequence from={divergence.from}>
        <Audio src={staticFile('vo-3-divergence.mp3')} />
      </Sequence>
      <Sequence from={divergence.from + VO4_START_IN_SCENE}>
        <Audio src={staticFile('vo-4-reveal.mp3')} />
      </Sequence>
      <Sequence from={cta.from}>
        <Audio src={staticFile('vo-5-cta.mp3')} />
      </Sequence>
    </AbsoluteFill>
  );
};
