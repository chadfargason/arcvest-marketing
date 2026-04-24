import React from 'react';
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig } from 'remotion';
import { episodeConfig, slidePlan, type Segment } from './config';
import { CaptionsOverlay } from './CaptionsOverlay';
import {
  TitleSlide,
  ChapterSlide,
  StatSlide,
  ChecklistSlide,
  QuoteSlide,
  ConceptSlide,
  OutroSlide,
  PrimerSlide,
  WorkedExampleSlide,
  TableSlide,
  GuardrailsDiagram,
} from '../../slides-library';

// Mode C composition: pure audio + slides only. No OffthreadVideo, no PIP paths.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSlide(kind: string, props: Record<string, any>): React.ReactNode {
  switch (kind) {
    case 'title':
      return <TitleSlide {...(props as React.ComponentProps<typeof TitleSlide>)} />;
    case 'chapter':
      return <ChapterSlide {...(props as React.ComponentProps<typeof ChapterSlide>)} />;
    case 'stat':
      return <StatSlide {...(props as React.ComponentProps<typeof StatSlide>)} />;
    case 'checklist':
      return <ChecklistSlide {...(props as React.ComponentProps<typeof ChecklistSlide>)} />;
    case 'quote':
      return <QuoteSlide {...(props as React.ComponentProps<typeof QuoteSlide>)} />;
    case 'concept':
      return <ConceptSlide {...(props as React.ComponentProps<typeof ConceptSlide>)} />;
    case 'primer':
      return <PrimerSlide {...(props as React.ComponentProps<typeof PrimerSlide>)} />;
    case 'worked-example':
      return <WorkedExampleSlide {...(props as React.ComponentProps<typeof WorkedExampleSlide>)} />;
    case 'table':
      return <TableSlide {...(props as React.ComponentProps<typeof TableSlide>)} />;
    case 'guardrails':
      return <GuardrailsDiagram {...(props as React.ComponentProps<typeof GuardrailsDiagram>)} />;
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
      {/* Source audio (MP3) — plays continuously for the whole episode */}
      <Audio src={staticFile(episodeConfig.sourceAudio)} />

      {/* Every segment is a slide */}
      <Series>
        {slidePlan.map((seg: Segment, i: number) => (
          <Series.Sequence
            key={i}
            durationInFrames={Math.max(1, sec(seg.endSec) - sec(seg.startSec))}
          >
            {renderSlide(seg.slide, seg.props)}
          </Series.Sequence>
        ))}
      </Series>

      {/* Captions always on, no suppression */}
      <CaptionsOverlay suppressedFrameRanges={[]} />
    </AbsoluteFill>
  );
};
