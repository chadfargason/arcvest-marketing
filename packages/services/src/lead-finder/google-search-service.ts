/**
 * Google Custom Search API Service
 * 
 * Uses Google Programmable Search Engine to find trigger-based leads.
 * Pricing: $5 per 1,000 queries after free tier (100/day)
 * 
 * Setup required:
 * 1. Create a Programmable Search Engine at https://programmablesearchengine.google.com/
 * 2. Enable "Search the entire web" option
 * 3. Get the Search Engine ID (cx parameter)
 * 4. Enable Custom Search API in Google Cloud Console
 * 5. Create an API key
 * 
 * Environment variables:
 * - GOOGLE_CUSTOM_SEARCH_API_KEY
 * - GOOGLE_CUSTOM_SEARCH_ENGINE_ID
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

export interface GoogleSearchResponse {
  items?: Array<{
    link: string;
    title: string;
    snippet: string;
    pagemap?: {
      metatags?: Array<{
        'article:published_time'?: string;
        'og:updated_time'?: string;
        'datePublished'?: string;
      }>;
    };
  }>;
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class GoogleSearchService {
  private apiKey: string;
  private searchEngineId: string;
  private baseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor() {
    this.apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';

    if (!this.apiKey) {
      console.warn('GOOGLE_CUSTOM_SEARCH_API_KEY not configured');
    }
    if (!this.searchEngineId) {
      console.warn('GOOGLE_CUSTOM_SEARCH_ENGINE_ID not configured');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.searchEngineId);
  }

  /**
   * Build date restriction parameter for recency filtering
   * Google uses format like "d7" for last 7 days
   */
  private buildDateRestrict(recencyDays?: number): string | undefined {
    if (!recencyDays) return undefined;
    return `d${recencyDays}`;
  }

  /**
   * Extract publication date from search result metadata
   */
  private extractPublishDate(item: GoogleSearchResponse['items'][0]): string | undefined {
    const metatags = item.pagemap?.metatags?.[0];
    if (!metatags) return undefined;

    const dateStr = metatags['article:published_time'] 
      || metatags['og:updated_time'] 
      || metatags['datePublished'];

    if (dateStr) {
      try {
        return new Date(dateStr).toISOString();
      } catch {
        return undefined;
      }
    }
    return undefined;
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
      console.error('Google Custom Search is not configured');
      return [];
    }

    const { query, recencyDays = 7, limit = 10 } = params;

    // Build URL with parameters
    const url = new URL(this.baseUrl);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('cx', this.searchEngineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', Math.min(limit, 10).toString()); // Max 10 per request

    // Add date restriction for recency
    const dateRestrict = this.buildDateRestrict(recencyDays);
    if (dateRestrict) {
      url.searchParams.set('dateRestrict', dateRestrict);
    }

    // Sort by date for most recent results
    url.searchParams.set('sort', 'date');

    try {
      const response = await fetch(url.toString());
      const data: GoogleSearchResponse = await response.json();

      if (data.error) {
        console.error('Google Search API error:', data.error.message);
        throw new Error(`Google Search API error: ${data.error.message}`);
      }

      if (!data.items || data.items.length === 0) {
        console.log(`No results found for query: ${query}`);
        return [];
      }

      console.log(`Found ${data.items.length} results for query: ${query}`);

      return data.items.map(item => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
        publishedAt: this.extractPublishDate(item),
        source: this.extractDomain(item.link),
      }));
    } catch (error) {
      console.error('Error performing Google search:', error);
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
export const googleSearchService = new GoogleSearchService();
