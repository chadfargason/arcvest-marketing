import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Series, staticFile, useVideoConfig } from 'remotion';
import { episodeConfig, slidePlan, type Segment } from './config';
import { CaptionsOverlay } from './CaptionsOverlay';
import {
  TitleSlide,
  ChapterSlide,
  TimelineSlide,
  DualLineChartSlide,
  ScoreboardSlide,
  StatSlide,
  ChecklistSlide,
  QuoteSlide,
  ConceptSlide,
  OutroSlide,
} from '../../slides-library';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSlide(kind: string, props: Record<string, any>): React.ReactNode {
  switch (kind) {
    case 'title':
      return <TitleSlide {...(props as React.ComponentProps<typeof TitleSlide>)} />;
    case 'chapter':
      return <ChapterSlide {...(props as React.ComponentProps<typeof ChapterSlide>)} />;
    case 'timeline':
      return <TimelineSlide {...(props as React.ComponentProps<typeof TimelineSlide>)} />;
    case 'dual-line':
      return <DualLineChartSlide {...(props as React.ComponentProps<typeof DualLineChartSlide>)} />;
    case 'scoreboard':
      return <ScoreboardSlide {...(props as React.ComponentProps<typeof ScoreboardSlide>)} />;
    case 'stat':
      return <StatSlide {...(props as React.ComponentProps<typeof StatSlide>)} />;
    case 'checklist':
      return <ChecklistSlide {...(props as React.ComponentProps<typeof ChecklistSlide>)} />;
    case 'quote':
      return <QuoteSlide {...(props as React.ComponentProps<typeof QuoteSlide>)} />;
    case 'concept':
      return <ConceptSlide {...(props as React.ComponentProps<typeof ConceptSlide>)} />;
    case 'outro':
      return <OutroSlide {...(props as React.ComponentProps<typeof OutroSlide>)} />;
    default:
      throw new Error(`Unknown slide kind: ${kind}`);
  }
}

export const EpisodeVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number): number => Math.round(s * fps);

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Audio track from the source MP4 — plays continuously, regardless of visual track */}
      <Audio src={staticFile(episodeConfig.sourceVideo)} />

      {/* Visual track */}
      <Series>
        {slidePlan.map((seg: Segment, i: number) => {
          const durationInFrames = Math.max(1, sec(seg.endSec) - sec(seg.startSec));
          return (
            <Series.Sequence key={i} durationInFrames={durationInFrames}>
              {seg.kind === 'video' ? (
                <OffthreadVideo
                  src={staticFile(episodeConfig.sourceVideo)}
                  startFrom={sec(seg.startSec)}
                  muted
                />
              ) : (
                renderSlide(seg.slide!, seg.props ?? {})
              )}
            </Series.Sequence>
          );
        })}
      </Series>

      {/* Captions overlay — always on top, uses absolute frames from transcript */}
      <CaptionsOverlay />
    </AbsoluteFill>
  );
};
