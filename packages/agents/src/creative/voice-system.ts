/**
 * Voice/Tone System for RSA Generation
 *
 * Each voice profile defines a distinct communication style
 * that can be applied to any audience persona.
 */

export interface VoiceProfile {
  id: string;
  name: string;
  displayName: string;
  description: string;
  characteristics: {
    sentenceStructure: 'short' | 'medium' | 'varied';
    vocabulary: 'simple' | 'professional' | 'technical';
    emotionalAppeal: 'logical' | 'emotional' | 'balanced';
    urgency: 'low' | 'medium' | 'high';
  };
  promptModifiers: string;
  headlinePatterns: string[];
  descriptionPatterns: string[];
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'educational',
    name: 'educational',
    displayName: 'Educational',
    description: 'Informative, helpful, positions ArcVest as a teacher',
    characteristics: {
      sentenceStructure: 'medium',
      vocabulary: 'simple',
      emotionalAppeal: 'logical',
      urgency: 'low',
    },
    promptModifiers: `
Write in an educational, informative tone. Position ArcVest as a helpful teacher.
Focus on sharing knowledge and insights. Avoid urgency or pressure.
Use phrases like "Learn why...", "Discover how...", "Understanding...".
Make complex concepts accessible without being condescending.
Headlines should inform and intrigue, not sell.
    `.trim(),
    headlinePatterns: [
      'Learn [Benefit/Concept]',
      'What [Topic] Means For You',
      'Understanding [Concept]',
      'Discover [Insight]',
      '[Number] Facts About [Topic]',
      'Why [Concept] Matters',
    ],
    descriptionPatterns: [
      'Learn why [benefit]. [Educational offer].',
      'Understand what [concept] means for your [goal]. [Soft CTA].',
      'Discover how [approach] can help you [outcome]. Free resources available.',
    ],
  },
  {
    id: 'direct',
    name: 'direct',
    displayName: 'Direct & Confident',
    description: 'Straightforward, no-nonsense, action-oriented',
    characteristics: {
      sentenceStructure: 'short',
      vocabulary: 'simple',
      emotionalAppeal: 'balanced',
      urgency: 'medium',
    },
    promptModifiers: `
Write with direct, confident language. Be straightforward and action-oriented.
Use short, punchy sentences. Make clear statements about value.
Avoid hedging or qualifiers. State benefits clearly.
Use phrases like "Get...", "Stop...", "Start...", "Your...".
Every word should earn its place.
    `.trim(),
    headlinePatterns: [
      'Stop [Problem]',
      'Get [Benefit]',
      'Your [Goal] Starts Here',
      '[Benefit]. Period.',
      'No [Pain Point]. Ever.',
      '[Action] Your [Asset]',
    ],
    descriptionPatterns: [
      'Stop [problem]. Get [benefit]. [Direct CTA].',
      'Your [goal] is too important for [problem]. [CTA] today.',
      '[Benefit] without [pain point]. [Simple CTA].',
    ],
  },
  {
    id: 'story-driven',
    name: 'story_driven',
    displayName: 'Story-Driven',
    description: 'Narrative approach, relatable scenarios',
    characteristics: {
      sentenceStructure: 'varied',
      vocabulary: 'simple',
      emotionalAppeal: 'emotional',
      urgency: 'low',
    },
    promptModifiers: `
Write with narrative elements that create relatable scenarios.
Paint pictures of situations readers can identify with.
Use "you" language to make it personal. Reference common experiences.
Focus on the journey and transformation.
Use phrases like "Imagine...", "Picture...", "What if...".
Connect emotionally before presenting solutions.
    `.trim(),
    headlinePatterns: [
      'Retire On Your Terms',
      'Your Next Chapter',
      'Picture Your [Goal]',
      'What If [Positive Scenario]?',
      'Your [Life Stage] Story',
      'The [Goal] You Deserve',
    ],
    descriptionPatterns: [
      'Picture [positive scenario]. Our clients [benefit]. [Soft CTA].',
      'What if your advisor truly [positive action]? Discover [differentiator].',
      'Your [life stage] should be [positive adjective]. Let us help you [outcome].',
    ],
  },
  {
    id: 'data-driven',
    name: 'data_driven',
    displayName: 'Data-Driven',
    description: 'Stats-focused, evidence-based, analytical',
    characteristics: {
      sentenceStructure: 'medium',
      vocabulary: 'professional',
      emotionalAppeal: 'logical',
      urgency: 'low',
    },
    promptModifiers: `
Write with data and evidence at the forefront. Reference statistics and research.
Appeal to analytical thinkers. Use specific numbers when possible.
Focus on measurable outcomes and proof points.
Use phrases like "Research shows...", "Data proves...", "92% of...".
NOTE: Do not fabricate statistics - use general evidence-based language
or well-known industry statistics only.
    `.trim(),
    headlinePatterns: [
      '[Stat] of [Category] [Outcome]',
      'The [Number]% That [Impact]',
      'Evidence-Based [Service]',
      '[Research] Shows [Insight]',
      'By The Numbers: [Topic]',
      'The Math Behind [Concept]',
    ],
    descriptionPatterns: [
      'Research shows [general finding]. Calculate your [metric]. [CTA].',
      'The data is clear: [evidence-based claim]. See the numbers for yourself.',
      '[Stat reference]. [Benefit statement]. [Analytical CTA].',
    ],
  },
  {
    id: 'authority',
    name: 'authority',
    displayName: 'Authority & Trust',
    description: 'Credibility-focused, professional, trustworthy',
    characteristics: {
      sentenceStructure: 'medium',
      vocabulary: 'professional',
      emotionalAppeal: 'balanced',
      urgency: 'medium',
    },
    promptModifiers: `
Write with authority and credibility. Emphasize expertise and trustworthiness.
Reference fiduciary duty, professional standards, and experience.
Use confident but not arrogant language.
Focus on credentials and commitment.
Use phrases like "Trusted...", "Certified...", "Committed to...".
Position ArcVest as the expert choice.
    `.trim(),
    headlinePatterns: [
      'Trusted [Service] Advisors',
      'Certified [Credential]',
      '[Years]+ Years of [Commitment]',
      'Your Interests First',
      'Fiduciary [Commitment]',
      '[Professional] Expertise',
    ],
    descriptionPatterns: [
      'Trust your [goal] to [credential] legally bound to your best interest.',
      'ArcVest: [Credential] committed to [principle]. [Authority CTA].',
      '[Experience statement]. [Commitment statement]. [Trust-building CTA].',
    ],
  },
];

export function getVoiceById(id: string): VoiceProfile | undefined {
  return VOICE_PROFILES.find((v) => v.id === id);
}

export function getVoicesByIds(ids: string[]): VoiceProfile[] {
  return VOICE_PROFILES.filter((v) => ids.includes(v.id));
}

export function getAllVoiceIds(): string[] {
  return VOICE_PROFILES.map((v) => v.id);
}
