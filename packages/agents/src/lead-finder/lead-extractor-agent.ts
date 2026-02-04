/**
 * Lead Extractor Agent
 * 
 * Uses Claude to extract structured lead information from page text.
 * Returns candidates with:
 * - Name, title, company, location
 * - Trigger type and category classification
 * - Rationale explaining why this is a lead
 * - Contact paths found on the page
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedCandidate, ExtractionResult } from '@arcvest/shared';

export type { ExtractedCandidate, ExtractionResult };

const EXTRACTION_SYSTEM_PROMPT = `You are a lead extraction specialist for a wealth management firm. Your job is to identify high-net-worth individuals from news articles and press releases.

Target profiles (in order of likelihood to have $1M+ net worth):
1. EXEC: C-suite executives, EVP, SVP, VP, Managing Directors, Partners at established companies
2. OWNER: Founders, owners of businesses, entrepreneurs who've raised funding or completed exits
3. PROFESSIONAL: Senior doctors, lawyers, investment bankers, consultants (typically 45+ years old)
4. REAL_ESTATE: Major property investors, real estate developers

Trigger events that indicate good timing for outreach:
- CAREER_MOVE: New appointment, promotion, or joining a new company in a senior role
- FUNDING_MNA: Company raised funding, was acquired, or completed a merger
- EXPANSION: Company opening new offices, expanding operations, relocating
- RECOGNITION: Board appointments, major awards, keynote speaking

CRITICAL RULES:
1. Only extract people EXPLICITLY mentioned in the text - never invent names
2. Only include contact information that is EXPLICITLY stated in the text
3. Focus on Texas-based people or companies
4. Provide evidence snippets that prove the person exists and has the stated role
5. Be conservative with confidence scores - only high confidence (>0.7) if clearly stated`;

const EXTRACTION_USER_PROMPT = `Extract potential high-net-worth leads from this article.

PAGE TITLE: {title}
SOURCE URL: {url}

ARTICLE TEXT:
{text}

---

Return a JSON object with this exact structure:
{
  "candidates": [
    {
      "fullName": "First Last",
      "title": "CFO",
      "company": "Company Name",
      "geoSignal": "Houston, TX",
      "triggerType": "career_move",
      "category": "exec",
      "rationaleShort": "One sentence explaining why this is a lead",
      "rationaleDetail": "2-3 sentences with more context about why this person likely has significant assets and is a good prospect",
      "contactPaths": [
        {"type": "company_contact_url", "value": "https://company.com/contact", "foundOnPage": true}
      ],
      "evidenceSnippets": ["Quote from article proving this person exists"],
      "confidence": 0.85
    }
  ]
}

If no relevant leads are found, return: {"candidates": []}

Rules:
- Only extract leads with Texas connection (works or lives in Texas)
- Only include contact info explicitly found in the text
- Confidence should reflect how clearly the information is stated
- Max 5 candidates per article
- Focus on quality over quantity`;

export class LeadExtractorAgent {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }

  /**
   * Extract leads from page text
   */
  async extractLeads(params: {
    pageTitle: string | null;
    sourceUrl: string;
    extractedText: string;
  }): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Truncate text to fit context window (leaving room for prompt and response)
    const maxTextLength = 12000;
    const truncatedText = params.extractedText.slice(0, maxTextLength);

    if (truncatedText.length < 100) {
      return {
        candidates: [],
        processingTime: Date.now() - startTime,
        tokensUsed: 0,
      };
    }

    const userPrompt = EXTRACTION_USER_PROMPT
      .replace('{title}', params.pageTitle || 'Unknown')
      .replace('{url}', params.sourceUrl)
      .replace('{text}', truncatedText);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      });

      const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
      
      // Extract JSON from response
      const content = response.content[0];
      if (!content || content.type !== 'text') {
        return {
          candidates: [],
          processingTime: Date.now() - startTime,
          tokensUsed,
        };
      }

      const candidates = this.parseResponse(content.text);

      return {
        candidates,
        processingTime: Date.now() - startTime,
        tokensUsed,
      };
    } catch (error) {
      console.error('Error extracting leads:', error);
      return {
        candidates: [],
        processingTime: Date.now() - startTime,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Parse Claude's response into structured candidates
   */
  private parseResponse(responseText: string): ExtractedCandidate[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
        return [];
      }

      // Validate and normalize each candidate
      return parsed.candidates
        .filter((c: unknown) => this.isValidCandidate(c))
        .map((c: ExtractedCandidate) => this.normalizeCandidate(c))
        .slice(0, 5); // Max 5 per article
    } catch (error) {
      console.error('Error parsing extraction response:', error);
      return [];
    }
  }

  /**
   * Validate that a candidate has required fields
   */
  private isValidCandidate(candidate: unknown): candidate is ExtractedCandidate {
    if (typeof candidate !== 'object' || candidate === null) return false;
    
    const c = candidate as Record<string, unknown>;
    
    // Must have a name
    if (typeof c['fullName'] !== 'string' || (c['fullName'] as string).length < 2) return false;
    
    // Must have rationale
    if (typeof c['rationaleShort'] !== 'string') return false;
    
    return true;
  }

  /**
   * Normalize candidate data
   */
  private normalizeCandidate(candidate: ExtractedCandidate): ExtractedCandidate {
    return {
      fullName: candidate.fullName.trim(),
      title: candidate.title?.trim() || null,
      company: candidate.company?.trim() || null,
      geoSignal: candidate.geoSignal?.trim() || null,
      triggerType: this.normalizeTriggerType(candidate.triggerType),
      category: this.normalizeCategory(candidate.category),
      rationaleShort: candidate.rationaleShort?.trim() || 'Potential high-net-worth prospect',
      rationaleDetail: candidate.rationaleDetail?.trim() || '',
      contactPaths: Array.isArray(candidate.contactPaths) ? candidate.contactPaths : [],
      evidenceSnippets: Array.isArray(candidate.evidenceSnippets) ? candidate.evidenceSnippets : [],
      confidence: typeof candidate.confidence === 'number' 
        ? Math.min(1, Math.max(0, candidate.confidence)) 
        : 0.5,
    };
  }

  /**
   * Normalize trigger type
   */
  private normalizeTriggerType(type: string): ExtractedCandidate['triggerType'] {
    const normalized = type?.toLowerCase().replace(/[^a-z_]/g, '');
    const validTypes = ['career_move', 'funding_mna', 'expansion', 'recognition'];
    return validTypes.includes(normalized) 
      ? normalized as ExtractedCandidate['triggerType']
      : 'other';
  }

  /**
   * Normalize category
   */
  private normalizeCategory(category: string): ExtractedCandidate['category'] {
    const normalized = category?.toLowerCase().replace(/[^a-z_]/g, '');
    const validCategories = ['exec', 'owner', 'professional', 'real_estate'];
    return validCategories.includes(normalized)
      ? normalized as ExtractedCandidate['category']
      : 'other';
  }

  /**
   * Batch process multiple pages
   */
  async extractLeadsBatch(pages: Array<{
    pageTitle: string | null;
    sourceUrl: string;
    extractedText: string;
  }>): Promise<Map<string, ExtractionResult>> {
    const results = new Map<string, ExtractionResult>();

    // Process sequentially to avoid rate limits
    for (const page of pages) {
      const result = await this.extractLeads(page);
      results.set(page.sourceUrl, result);
      
      // Small delay between API calls
      await this.delay(500);
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
export const leadExtractorAgent = new LeadExtractorAgent();
