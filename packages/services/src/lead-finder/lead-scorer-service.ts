/**
 * Lead Scoring Service
 * 
 * Scores and ranks extracted leads based on:
 * - Recency of trigger event
 * - Seniority / wealth proxy
 * - Trigger strength
 * - Reachability (contact paths found)
 * 
 * Also handles deduplication against existing leads.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCandidate } from '@arcvest/shared';

export interface ScoredLead extends ExtractedCandidate {
  score: number;
  tier: 'A' | 'B' | 'C' | 'D';
  personKey: string;
  scoreBreakdown: {
    recency: number;
    seniority: number;
    triggerStrength: number;
    reachability: number;
  };
}

export interface ScoreWeights {
  recency: number;      // Max 25 points
  seniority: number;    // Max 35 points
  triggerStrength: number; // Max 25 points
  reachability: number;    // Max 15 points
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  recency: 25,
  seniority: 35,
  triggerStrength: 25,
  reachability: 15,
};

// Title seniority mapping
const TITLE_SENIORITY: Record<string, number> = {
  // C-Suite (35 points)
  'ceo': 35, 'chief executive': 35, 'president': 35,
  'cfo': 35, 'chief financial': 35,
  'coo': 35, 'chief operating': 35,
  'cto': 35, 'chief technology': 35,
  'cmo': 35, 'chief marketing': 35,
  'cio': 35, 'chief information': 35,
  
  // EVP/Partner level (30 points)
  'evp': 30, 'executive vice president': 30,
  'partner': 30, 'managing partner': 30,
  'managing director': 30,
  'general partner': 30,
  
  // SVP level (25 points)
  'svp': 25, 'senior vice president': 25,
  'principal': 25,
  
  // VP level (20 points)
  'vp': 20, 'vice president': 20,
  
  // Director level (15 points)
  'director': 15, 'head of': 15,
  
  // Owner/Founder (30 points - high wealth likelihood)
  'founder': 30, 'co-founder': 30,
  'owner': 30, 'co-owner': 25,
  
  // Professionals (15-25 points)
  'physician': 20, 'doctor': 20, 'surgeon': 25,
  'attorney': 20, 'lawyer': 20, 'counsel': 18,
  'investment banker': 25, 'banker': 18,
  
  // Default
  'manager': 10,
};

export class LeadScorerService {
  private _supabase: SupabaseClient | null = null;

  private get supabase(): SupabaseClient {
    if (!this._supabase) {
      this._supabase = createClient(
        process.env['NEXT_PUBLIC_SUPABASE_URL']!,
        process.env['SUPABASE_SERVICE_KEY']!
      );
    }
    return this._supabase;
  }

  constructor() {
    // Supabase client is lazy-loaded on first access
  }

  /**
   * Generate a person key for deduplication
   */
  generatePersonKey(candidate: ExtractedCandidate): string {
    const normalizedName = this.normalizeName(candidate.fullName);
    const normalizedCompany = this.normalizeCompany(candidate.company || '');
    const normalizedGeo = this.normalizeGeo(candidate.geoSignal || '');
    
    return `${normalizedName}|${normalizedCompany}|${normalizedGeo}`;
  }

  /**
   * Normalize name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings (0-1, where 1 is identical)
   * Uses Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(s1, s2);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const track = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    return track[str2.length][str1.length];
  }

  /**
   * Check if two leads are duplicates
   * Returns true if they're the same person
   * Simple rule: Same name in same city = duplicate
   */
  private areFuzzyDuplicates(lead1: ScoredLead, lead2: ScoredLead): boolean {
    const name1 = this.normalizeName(lead1.fullName);
    const name2 = this.normalizeName(lead2.fullName);
    
    // Exact name match = duplicate (regardless of company/title differences)
    if (name1 === name2) {
      return true;
    }
    
    // Very close name match (>95% similar) also counts as duplicate
    const nameSimilarity = this.calculateSimilarity(name1, name2);
    if (nameSimilarity > 0.95) {
      return true;
    }
    
    return false;
  }

  /**
   * Normalize company name for comparison
   */
  private normalizeCompany(company: string): string {
    return company
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(inc|llc|corp|corporation|company|co|ltd)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize geo signal
   */
  private normalizeGeo(geo: string): string {
    return geo
      .toLowerCase()
      .replace(/[^a-z\s,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate recency score (max 25 points)
   */
  private scoreRecency(publishedAt: string | null): number {
    if (!publishedAt) return 15; // Unknown date, give middle score
    
    try {
      const publishDate = new Date(publishedAt);
      const now = new Date();
      const daysAgo = Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysAgo <= 2) return 25;  // Very recent
      if (daysAgo <= 7) return 20;  // Within a week
      if (daysAgo <= 14) return 15; // Within 2 weeks
      if (daysAgo <= 30) return 10; // Within a month
      return 5;                      // Older
    } catch {
      return 15;
    }
  }

  /**
   * Calculate seniority score (max 35 points)
   */
  private scoreSeniority(title: string | null, category: string): number {
    if (!title) {
      // Use category as fallback
      switch (category) {
        case 'exec': return 20;
        case 'owner': return 25;
        case 'professional': return 15;
        default: return 10;
      }
    }

    const normalizedTitle = title.toLowerCase();
    
    // Check for title matches
    for (const [keyword, score] of Object.entries(TITLE_SENIORITY)) {
      if (normalizedTitle.includes(keyword)) {
        return score;
      }
    }

    // Fallback to category
    switch (category) {
      case 'exec': return 15;
      case 'owner': return 20;
      case 'professional': return 12;
      default: return 8;
    }
  }

  /**
   * Calculate trigger strength score (max 25 points)
   */
  private scoreTriggerStrength(triggerType: string, confidence: number): number {
    let baseScore: number;
    
    switch (triggerType) {
      case 'career_move':
        baseScore = 25; // New role = great timing
        break;
      case 'funding_mna':
        baseScore = 22; // Liquidity event
        break;
      case 'expansion':
        baseScore = 18; // Growth signal
        break;
      case 'recognition':
        baseScore = 15; // Authority signal
        break;
      default:
        baseScore = 10;
    }
    
    // Adjust by confidence
    return Math.round(baseScore * confidence);
  }

  /**
   * Calculate reachability score (max 15 points)
   */
  private scoreReachability(contactPaths: ExtractedCandidate['contactPaths']): number {
    if (!contactPaths || contactPaths.length === 0) return 3;
    
    let score = 0;
    const pathTypes = new Set(contactPaths.map((p: any) => p.type));
    
    if (pathTypes.has('bio_url')) score += 5;
    if (pathTypes.has('company_contact_url')) score += 4;
    if (pathTypes.has('linkedin')) score += 4;
    if (pathTypes.has('phone')) score += 3;
    if (pathTypes.has('generic_email')) score += 2;
    
    return Math.min(15, score);
  }

  /**
   * Assign tier based on score
   */
  private assignTier(score: number): 'A' | 'B' | 'C' | 'D' {
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  }

  /**
   * Score a single candidate
   */
  scoreLead(
    candidate: ExtractedCandidate,
    publishedAt: string | null = null,
    weights: ScoreWeights = DEFAULT_WEIGHTS
  ): ScoredLead {
    const recency = this.scoreRecency(publishedAt);
    const seniority = this.scoreSeniority(candidate.title, candidate.category);
    const triggerStrength = this.scoreTriggerStrength(candidate.triggerType, candidate.confidence);
    const reachability = this.scoreReachability(candidate.contactPaths);

    // Calculate weighted score (normalize to 0-100)
    const maxPossible = weights.recency + weights.seniority + weights.triggerStrength + weights.reachability;
    const rawScore = recency + seniority + triggerStrength + reachability;
    const normalizedScore = Math.round((rawScore / maxPossible) * 100);

    return {
      ...candidate,
      score: normalizedScore,
      tier: this.assignTier(normalizedScore),
      personKey: this.generatePersonKey(candidate),
      scoreBreakdown: {
        recency,
        seniority,
        triggerStrength,
        reachability,
      },
    };
  }

  /**
   * Score multiple candidates and sort by score
   */
  scoreLeads(
    candidates: ExtractedCandidate[],
    publishedAt: string | null = null
  ): ScoredLead[] {
    return candidates
      .map(c => this.scoreLead(c, publishedAt))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Check for existing leads with same person key (deduplication)
   */
  async checkDuplicates(personKeys: string[], cooldownDays = 90): Promise<Set<string>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cooldownDays);

    const { data, error } = await this.supabase
      .from('lead_finder_leads')
      .select('person_key')
      .in('person_key', personKeys)
      .gte('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error checking duplicates:', error);
      return new Set();
    }

    return new Set(data?.map(d => d.person_key) || []);
  }

  /**
   * Check suppression list
   */
  async checkSuppression(personKeys: string[]): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('lead_finder_suppression')
      .select('value')
      .eq('type', 'person_key')
      .in('value', personKeys);

    if (error) {
      console.error('Error checking suppression:', error);
      return new Set();
    }

    return new Set(data?.map(d => d.value) || []);
  }

  /**
   * Filter and dedupe leads, returning top N
   */
  async selectTopLeads(
    scoredLeads: ScoredLead[],
    targetCount: number,
    cooldownDays = 90
  ): Promise<ScoredLead[]> {
    // First, do in-memory fuzzy deduplication
    const fuzzyFiltered: ScoredLead[] = [];
    for (const lead of scoredLeads) {
      const isDuplicate = fuzzyFiltered.some(existing => 
        this.areFuzzyDuplicates(lead, existing)
      );
      
      if (!isDuplicate) {
        fuzzyFiltered.push(lead);
      } else {
        console.log(`Fuzzy duplicate detected: ${lead.fullName} at ${lead.company}`);
      }
    }
    
    // Get person keys for dedup check
    const personKeys = fuzzyFiltered.map(l => l.personKey);
    
    // Check for duplicates and suppression in parallel
    const [duplicates, suppressed] = await Promise.all([
      this.checkDuplicates(personKeys, cooldownDays),
      this.checkSuppression(personKeys),
    ]);

    // Filter out duplicates and suppressed
    let filtered = fuzzyFiltered.filter(lead => 
      !duplicates.has(lead.personKey) && !suppressed.has(lead.personKey)
    );

    // Apply diversity rules
    // Max 4 from same company
    const companyCount = new Map<string, number>();
    filtered = filtered.filter(lead => {
      const company = (lead as any).company?.toLowerCase() || 'unknown';
      const count = companyCount.get(company) || 0;
      if (count >= 4) return false;
      companyCount.set(company, count + 1);
      return true;
    });

    // Max 8 from same trigger type (unless insufficient leads)
    const triggerCount = new Map<string, number>();
    const diverseFiltered = filtered.filter(lead => {
      const count = triggerCount.get((lead as any).triggerType) || 0;
      if (count >= 8 && filtered.length > targetCount * 1.5) return false;
      triggerCount.set((lead as any).triggerType, count + 1);
      return true;
    });

    // Return top N
    return diverseFiltered.slice(0, targetCount);
  }
}

// Export singleton
let _leadScorerServiceInstance: LeadScorerService | null = null;

export function getLeadScorerService(): LeadScorerService {
  if (!_leadScorerServiceInstance) {
    _leadScorerServiceInstance = new LeadScorerService();
  }
  return _leadScorerServiceInstance;
}
