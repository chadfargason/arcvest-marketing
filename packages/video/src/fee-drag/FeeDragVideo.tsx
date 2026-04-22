import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { HookNumber } from './scenes/01-HookNumber';
import { SplitScreen } from './scenes/02-SplitScreen';
import { DualLineChart } from './scenes/03-DualLineChart';
import { Reveal } from './scenes/04-Reveal';
import { CTA } from './scenes/05-CTA';
import { CaptionsOverlay } from './CaptionsOverlay';
import { feeDragConfig } from './config';

const { hook, splitScreen, divergence, reveal, cta } = feeDragConfig.scenes;

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
      <Sequence from={reveal.from} durationInFrames={reveal.duration}>
        <Reveal />
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
      <Sequence from={reveal.from}>
        <Audio src={staticFile('vo-4-reveal.mp3')} />
      </Sequence>
      <Sequence from={cta.from}>
        <Audio src={staticFile('vo-5-cta.mp3')} />
      </Sequence>
    </AbsoluteFill>
  );
};
