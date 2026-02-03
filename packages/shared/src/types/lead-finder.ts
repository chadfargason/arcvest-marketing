/**
 * Lead Finder Type Definitions
 * 
 * Shared types used across @arcvest/services and @arcvest/agents
 * for lead finding functionality.
 */

export interface ExtractedCandidate {
  fullName: string;
  title: string | null;
  company: string | null;
  geoSignal: string | null;
  triggerType: 'career_move' | 'funding_mna' | 'expansion' | 'recognition' | 'other';
  category: 'exec' | 'owner' | 'professional' | 'real_estate' | 'other';
  rationaleShort: string;
  rationaleDetail: string;
  contactPaths: Array<{
    type: 'company_contact_url' | 'bio_url' | 'linkedin' | 'phone' | 'generic_email' | 'other';
    value: string;
    foundOnPage: boolean;
  }>;
  evidenceSnippets: string[];
  confidence: number; // 0-1
}

export interface ExtractionResult {
  candidates: ExtractedCandidate[];
  processingTime: number;
  tokensUsed: number;
}
