/**
 * Lead Finder Module
 * 
 * Exports all lead finder services and types.
 */

export { GoogleSearchService, googleSearchService } from './google-search-service';
export type { SearchResult, SearchQuery } from './google-search-service';

export { PageFetcherService, pageFetcherService } from './page-fetcher-service';
export type { FetchedPage, FetchOptions } from './page-fetcher-service';

export { LeadScorerService, leadScorerService } from './lead-scorer-service';
export type { ScoredLead, ScoreWeights } from './lead-scorer-service';

export { LeadFinderOrchestrator, leadFinderOrchestrator } from './orchestrator';
export type { RunConfig, RunStats, RunResult } from './orchestrator';

// Re-export agent types for convenience
export type { ExtractedCandidate, EmailTone, GeneratedEmail } from '@arcvest/agents';
