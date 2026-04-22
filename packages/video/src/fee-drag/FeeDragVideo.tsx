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

// Per-scene VO offsets, in frames. Within scene 3, three sub-clips at named year cues.
const VO_OFFSETS = {
  hook: hook.from,
  setup: splitScreen.from,
  year10: divergence.from + 150,
  year20: divergence.from + 330,
  year30: divergence.from + 540,
  reveal: reveal.from + 35,
  cta: cta.from,
} as const;

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

      <Sequence from={VO_OFFSETS.hook}>
        <Audio src={staticFile('vo-1-hook.mp3')} />
      </Sequence>
      <Sequence from={VO_OFFSETS.setup}>
        <Audio src={staticFile('vo-2-setup.mp3')} />
      </Sequence>
      <Sequence from={VO_OFFSETS.year10}>
        <Audio src={staticFile('vo-3a-year10.mp3')} />
      </Sequence>
      <Sequence from={VO_OFFSETS.year20}>
        <Audio src={staticFile('vo-3b-year20.mp3')} />
      </Sequence>
      <Sequence from={VO_OFFSETS.year30}>
        <Audio src={staticFile('vo-3c-year30.mp3')} />
      </Sequence>
      <Sequence from={VO_OFFSETS.reveal}>
        <Audio src={staticFile('vo-4-reveal.mp3')} />
      </Sequence>
      <Sequence from={VO_OFFSETS.cta}>
        <Audio src={staticFile('vo-5-cta.mp3')} />
      </Sequence>
    </AbsoluteFill>
  );
};
