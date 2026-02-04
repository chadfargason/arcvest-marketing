/**
 * Serper.dev Search API Service
 * 
 * Uses Serper.dev to search Google for trigger-based leads.
 * Pricing: Free tier (2,500 searches/month), then $50/mo for 10,000 searches
 * 
 * Setup required:
 * 1. Sign up at https://serper.dev/
 * 2. Get your API key from the dashboard
 * 
 * Environment variables:
 * - SERPER_API_KEY
 */

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
}

export interface SearchQuery {
  query: string;
  recencyDays?: number;
  limit?: number;
}

export interface SerperSearchResponse {
  organic?: Array<{
    link: string;
    title: string;
    snippet: string;
    date?: string;
    position?: number;
  }>;
  searchParameters?: {
    q: string;
    num: number;
  };
  error?: string;
}

export class GoogleSearchService {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev/search';

  constructor() {
    this.apiKey = process.env['SERPER_API_KEY'] || '';

    if (!this.apiKey) {
      console.warn('SERPER_API_KEY not configured');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Build date restriction parameter for recency filtering
   * Serper uses format like "qdr:d7" for last 7 days
   */
  private buildDateRestrict(recencyDays?: number): string | undefined {
    if (!recencyDays) return undefined;
    return `qdr:d${recencyDays}`;
  }

  /**
   * Extract publication date from search result
   */
  private extractPublishDate(item: NonNullable<SerperSearchResponse['organic']>[number]): string | undefined {
    if (!item.date) return undefined;

    try {
      return new Date(item.date).toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Perform a search query
   */
  async search(params: SearchQuery): Promise<SearchResult[]> {
    if (!this.isConfigured()) {
      console.error('Serper API is not configured');
      return [];
    }

    const { query, recencyDays = 7, limit = 10 } = params;

    // Build request body
    const body: Record<string, string | number> = {
      q: query,
      num: Math.min(limit, 10), // Max 10 per request
    };

    // Add date restriction for recency
    const dateRestrict = this.buildDateRestrict(recencyDays);
    if (dateRestrict) {
      body.tbs = dateRestrict;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error (${response.status}): ${errorText}`);
      }

      const data: SerperSearchResponse = await response.json();

      if (data.error) {
        console.error('Serper API error:', data.error);
        throw new Error(`Serper API error: ${data.error}`);
      }

      if (!data.organic || data.organic.length === 0) {
        console.log(`No results found for query: ${query}`);
        return [];
      }

      console.log(`Found ${data.organic.length} results for query: ${query}`);

      return data.organic.map(item => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
        publishedAt: this.extractPublishDate(item),
        source: this.extractDomain(item.link),
      }));
    } catch (error) {
      console.error('Error performing Serper search:', error);
      throw error;
    }
  }

  /**
   * Perform multiple searches with rate limiting
   */
  async searchBatch(queries: SearchQuery[], delayMs = 200): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();

    for (const queryParams of queries) {
      try {
        const searchResults = await this.search(queryParams);
        results.set(queryParams.query, searchResults);
        
        // Rate limiting between requests
        if (queries.indexOf(queryParams) < queries.length - 1) {
          await this.delay(delayMs);
        }
      } catch (error) {
        console.error(`Search failed for query "${queryParams.query}":`, error);
        results.set(queryParams.query, []);
      }
    }

    return results;
  }

  /**
   * Build trigger-based search queries for lead finding
   */
  buildTriggerQueries(params: {
    geoAliases: string[];
    triggerFocus: string;
    industryFocus?: string;
  }): string[] {
    const { geoAliases, triggerFocus, industryFocus } = params;
    const queries: string[] = [];

    // Career move query templates
    const careerMoveTemplates = [
      '("{GEO}") (appointed OR named OR promoted) (CFO OR "Chief Financial Officer" OR CEO OR COO)',
      '("{GEO}") ("joins as" OR "named as") (SVP OR EVP OR "Managing Director" OR Partner)',
      '("{GEO}") (promoted OR appointed) ("Vice President" OR SVP OR EVP OR Director)',
      '("{GEO}") ("new CEO" OR "new CFO" OR "new COO" OR "new President")',
    ];

    // Funding/M&A query templates
    const fundingMnaTemplates = [
      '("{GEO}" OR "{GEO}-based") (acquired OR acquisition OR merger OR "to acquire")',
      '("{GEO}" OR "{GEO}-based") (raises OR funding OR "Series A" OR "Series B" OR "seed round")',
      '("{GEO}" OR "{GEO}-based") ("private equity" OR "venture capital") (investment OR deal)',
      '("{GEO}") (IPO OR "public offering" OR "goes public")',
    ];

    // Expansion query templates
    const expansionTemplates = [
      '("{GEO}") ("opens" OR "expands" OR "new office" OR "new headquarters")',
      '("{GEO}") ("relocates" OR "moves headquarters" OR "expands operations")',
      '("{GEO}") ("hiring" OR "new jobs" OR "expansion") (executive OR leadership)',
    ];

    // Industry modifiers
    const industryModifiers: Record<string, string> = {
      energy: '(oil OR gas OR energy OR midstream OR upstream OR refinery OR power)',
      healthcare: '(healthcare OR hospital OR physician OR medical OR clinic)',
      professional_services: '(law firm OR accounting OR consulting OR advisory)',
      tech: '(software OR technology OR AI OR SaaS OR cloud OR startup)',
      real_estate: '(real estate OR developer OR multifamily OR commercial property)',
      finance: '(private equity OR investment bank OR wealth OR hedge fund OR financial)',
    };

    // Select templates based on trigger focus
    let templates: string[];
    switch (triggerFocus) {
      case 'career_move':
        templates = careerMoveTemplates;
        break;
      case 'funding_mna':
        templates = fundingMnaTemplates;
        break;
      case 'expansion':
        templates = expansionTemplates;
        break;
      default:
        // Mix of all triggers
        templates = [
          ...careerMoveTemplates.slice(0, 2),
          ...fundingMnaTemplates.slice(0, 2),
          ...expansionTemplates.slice(0, 1),
        ];
    }

    // Build queries for each geo alias and template
    for (const geo of geoAliases) {
      for (const template of templates) {
        let query = template.replace(/\{GEO\}/g, geo);
        
        // Add industry modifier if specified
        if (industryFocus && industryModifiers[industryFocus]) {
          query += ` ${industryModifiers[industryFocus]}`;
        }

        queries.push(query);
      }
    }

    return queries;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
let _googleSearchServiceInstance: GoogleSearchService | null = null;

export function getGoogleSearchService(): GoogleSearchService {
  if (!_googleSearchServiceInstance) {
    _googleSearchServiceInstance = new GoogleSearchService();
  }
  return _googleSearchServiceInstance;
}
