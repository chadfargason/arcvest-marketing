/**
 * Lead Finder Orchestrator
 * 
 * Main orchestration service that coordinates the entire lead finding pipeline:
 * 1. Determine today's rotation (geo, trigger, industry)
 * 2. Build and execute search queries
 * 3. Fetch and process pages
 * 4. Extract candidates with LLM
 * 5. Score and dedupe leads
 * 6. Generate email drafts
 * 7. Store everything in Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleSearchService, SearchResult } from './google-search-service';
import { PageFetcherService, FetchedPage } from './page-fetcher-service';
import { LeadScorerService, ScoredLead } from './lead-scorer-service';
// @ts-ignore - @arcvest/agents is external dependency
import {
  LeadExtractorAgent,
  EmailGeneratorAgent,
  type ExtractedCandidate,
  type EmailTone,
  type GeneratedEmail,
} from '@arcvest/agents';

export interface RunConfig {
  geoName: string;
  geoAliases: string[];
  triggerFocus: string;
  industryFocus?: string;
  dailyLeadTarget: number;
  candidateTarget: number;
  recencyDays: number;
  leadCooldownDays: number;
  emailTones: EmailTone[];
}

export interface RunStats {
  queriesExecuted: number;
  searchResultsFound: number;
  pagesFetched: number;
  candidatesExtracted: number;
  leadsScored: number;
  leadsSelected: number;
  emailsGenerated: number;
  errors: string[];
  timing: {
    searchMs: number;
    fetchMs: number;
    extractMs: number;
    scoreMs: number;
    emailMs: number;
    totalMs: number;
  };
}

export interface RunResult {
  runId: string;
  status: 'success' | 'failed';
  stats: RunStats;
  leads: ScoredLead[];
  errorMessage?: string;
}

export class LeadFinderOrchestrator {
  private supabase: SupabaseClient;
  private searchService: GoogleSearchService;
  private fetcherService: PageFetcherService;
  private extractorAgent: LeadExtractorAgent;
  private scorerService: LeadScorerService;
  private emailAgent: EmailGeneratorAgent;

  constructor() {
    this.supabase = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_KEY']!
    );
    this.searchService = new GoogleSearchService();
    this.fetcherService = new PageFetcherService();
    this.extractorAgent = new LeadExtractorAgent();
    this.scorerService = new LeadScorerService();
    this.emailAgent = new EmailGeneratorAgent();
  }

  /**
   * Get configuration from database
   */
  async getConfig(): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase
      .from('lead_finder_config')
      .select('key, value');

    if (error) {
      console.error('Error fetching config:', error);
      return {};
    }

    return Object.fromEntries(data?.map(d => [d.key, d.value]) || []);
  }

  /**
   * Determine today's rotation parameters
   */
  async determineTodayRotation(): Promise<RunConfig> {
    const config = await this.getConfig();
    
    // Get lists from config
    const geoList = (config['geo_list'] as Array<{ name: string; aliases: string[] }>) || [];
    const triggerList = (config['trigger_list'] as string[]) || ['career_move', 'funding_mna', 'expansion'];
    const industryList = (config['industry_list'] as string[]) || [];
    const emailTones = (config['email_tones'] as EmailTone[]) || ['congratulatory', 'value_first', 'peer_credibility', 'direct_curious'];

    // Calculate day index for rotation
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

    // Rotate through geos (change daily)
    const geoIndex = dayOfYear % geoList.length;
    const geo = geoList[geoIndex] || { name: 'Houston', aliases: ['Houston'] };

    // Rotate through triggers (change daily)
    const triggerIndex = dayOfYear % triggerList.length;
    const trigger = triggerList[triggerIndex] || 'career_move';

    // Rotate through industries (optional, change every 2 days)
    const industryIndex = Math.floor(dayOfYear / 2) % industryList.length;
    const industry = industryList.length > 0 ? industryList[industryIndex] : undefined;

    return {
      geoName: geo.name,
      geoAliases: geo.aliases,
      triggerFocus: trigger,
      industryFocus: industry,
      dailyLeadTarget: (config['daily_lead_target'] as number) || 20,
      candidateTarget: (config['candidate_target'] as number) || 60,
      recencyDays: (config['recency_days'] as number) || 7,
      leadCooldownDays: (config['lead_cooldown_days'] as number) || 90,
      emailTones,
    };
  }

  /**
   * Create a new run record
   */
  async createRun(config: RunConfig): Promise<string> {
    const { data, error } = await this.supabase
      .from('lead_finder_runs')
      .insert({
        run_date: new Date().toISOString().split('T')[0],
        geo_name: config.geoName,
        geo_aliases: config.geoAliases,
        trigger_focus: config.triggerFocus,
        industry_focus: config.industryFocus,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Handle duplicate run for today
      if (error.code === '23505') {
        console.log('Run already exists for today, fetching existing...');
        const { data: existing } = await this.supabase
          .from('lead_finder_runs')
          .select('id')
          .eq('run_date', new Date().toISOString().split('T')[0])
          .single();
        return existing?.id;
      }
      throw new Error(`Failed to create run: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update run status and stats
   */
  async updateRun(runId: string, updates: {
    status?: 'success' | 'failed';
    stats?: RunStats;
    errorMessage?: string;
  }): Promise<void> {
    const updateData: Record<string, unknown> = {};
    
    if (updates.status) {
      updateData['status'] = updates.status;
      updateData['ended_at'] = new Date().toISOString();
    }
    if (updates.stats) {
      updateData['stats'] = updates.stats;
    }
    if (updates.errorMessage) {
      updateData['error_message'] = updates.errorMessage;
    }

    await this.supabase
      .from('lead_finder_runs')
      .update(updateData)
      .eq('id', runId);
  }

  /**
   * Store search results
   */
  async storeSearchResults(runId: string, query: string, results: SearchResult[]): Promise<void> {
    if (results.length === 0) return;

    const rows = results.map(r => ({
      run_id: runId,
      query,
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      published_at: r.publishedAt,
    }));

    await this.supabase
      .from('lead_finder_search_results')
      .upsert(rows, { onConflict: 'run_id,url' });
  }

  /**
   * Store fetched pages
   */
  async storePages(runId: string, pages: FetchedPage[]): Promise<Map<string, string>> {
    const urlToPageId = new Map<string, string>();
    
    for (const page of pages) {
      if (page.error) continue;

      const { data, error } = await this.supabase
        .from('lead_finder_pages')
        .upsert({
          run_id: runId,
          url: page.url,
          final_url: page.finalUrl,
          domain: page.domain,
          http_status: page.httpStatus,
          page_title: page.pageTitle,
          published_at_guess: page.publishedAtGuess,
          extracted_text: page.extractedText,
          content_hash: page.contentHash,
          fetched_at: page.fetchedAt,
        }, { onConflict: 'run_id,url' })
        .select('id')
        .single();

      if (!error && data) {
        urlToPageId.set(page.url, data.id);
      }
    }

    return urlToPageId;
  }

  /**
   * Store leads and emails
   */
  async storeLeadsAndEmails(
    runId: string,
    leads: ScoredLead[],
    emails: Map<string, GeneratedEmail | null>,
    urlToPageId: Map<string, string>
  ): Promise<void> {
    for (const lead of leads) {
      // Find page ID from URL (approximate match)
      let pageId: string | undefined;
      for (const [url, id] of urlToPageId) {
        if ((lead as any).evidenceSnippets?.length > 0) {
          pageId = id;
          break;
        }
      }

      // Insert lead
      const { data: leadData, error: leadError } = await this.supabase
        .from('lead_finder_leads')
        .upsert({
          run_id: runId,
          page_id: pageId,
          person_key: lead.personKey,
          full_name: (lead as any).fullName,
          title: (lead as any).title,
          company: (lead as any).company,
          geo_signal: (lead as any).geoSignal,
          trigger_type: (lead as any).triggerType,
          category: (lead as any).category,
          score: lead.score,
          tier: lead.tier,
          rationale_short: (lead as any).rationaleShort,
          rationale_detail: (lead as any).rationaleDetail,
          evidence_snippets: (lead as any).evidenceSnippets,
          contact_paths: (lead as any).contactPaths,
          outreach_status: 'email_ready',
        }, { onConflict: 'run_id,person_key' })
        .select('id')
        .single();

      if (leadError || !leadData) {
        console.error('Error storing lead:', leadError);
        continue;
      }

      // Insert email if generated
      const email = emails.get(lead.personKey);
      if (email) {
        await this.supabase
          .from('lead_finder_emails')
          .insert({
            lead_id: leadData.id,
            version: 1,
            subject: email.subject,
            body_html: email.bodyHtml,
            body_plain: email.bodyPlain,
            tone: email.tone,
          });
      }
    }
  }

  /**
   * Execute a full lead finding run
   */
  async executeRun(config?: RunConfig): Promise<RunResult> {
    const startTime = Date.now();
    const stats: RunStats = {
      queriesExecuted: 0,
      searchResultsFound: 0,
      pagesFetched: 0,
      candidatesExtracted: 0,
      leadsScored: 0,
      leadsSelected: 0,
      emailsGenerated: 0,
      errors: [],
      timing: {
        searchMs: 0,
        fetchMs: 0,
        extractMs: 0,
        scoreMs: 0,
        emailMs: 0,
        totalMs: 0,
      },
    };

    // Get or use provided config
    const runConfig = config || await this.determineTodayRotation();
    console.log('Starting lead finder run:', runConfig);

    // Create run record
    let runId: string;
    try {
      runId = await this.createRun(runConfig);
    } catch (error) {
      return {
        runId: '',
        status: 'failed',
        stats,
        leads: [],
        errorMessage: `Failed to create run: ${error}`,
      };
    }

    try {
      // Step 1: Build and execute search queries
      console.log('Step 1: Searching...');
      const searchStart = Date.now();
      
      const queries = this.searchService.buildTriggerQueries({
        geoAliases: runConfig.geoAliases,
        triggerFocus: runConfig.triggerFocus,
        industryFocus: runConfig.industryFocus,
      });

      // Limit queries to avoid excessive API usage
      const limitedQueries = queries.slice(0, 15);
      stats.queriesExecuted = limitedQueries.length;

      const allSearchResults: SearchResult[] = [];
      for (const query of limitedQueries) {
        const results = await this.searchService.search({
          query,
          recencyDays: runConfig.recencyDays,
          limit: 10,
        });
        allSearchResults.push(...results);
        await this.storeSearchResults(runId, query, results);
      }

      // Dedupe URLs
      const uniqueUrls = [...new Set(allSearchResults.map(r => r.url))];
      stats.searchResultsFound = uniqueUrls.length;
      stats.timing.searchMs = Date.now() - searchStart;
      console.log(`Found ${uniqueUrls.length} unique URLs from ${stats.queriesExecuted} queries`);

      // Step 2: Fetch pages
      console.log('Step 2: Fetching pages...');
      const fetchStart = Date.now();
      
      // Limit pages to fetch
      const urlsToFetch = uniqueUrls.slice(0, 30);
      const pages = await this.fetcherService.fetchPages(urlsToFetch);
      const successfulPages = pages.filter(p => !p.error && p.extractedText.length > 100);
      
      stats.pagesFetched = successfulPages.length;
      stats.timing.fetchMs = Date.now() - fetchStart;
      console.log(`Successfully fetched ${successfulPages.length} pages`);

      // Store pages and get mapping
      const urlToPageId = await this.storePages(runId, successfulPages);

      // Step 3: Extract candidates
      console.log('Step 3: Extracting candidates...');
      const extractStart = Date.now();

      const allCandidates: { candidate: ExtractedCandidate; publishedAt: string | null }[] = [];
      
      for (const page of successfulPages) {
        const result = await this.extractorAgent.extractLeads({
          pageTitle: page.pageTitle,
          sourceUrl: page.finalUrl,
          extractedText: page.extractedText,
        });

        for (const candidate of result.candidates) {
          allCandidates.push({
            candidate,
            publishedAt: page.publishedAtGuess,
          });
        }
      }

      stats.candidatesExtracted = allCandidates.length;
      stats.timing.extractMs = Date.now() - extractStart;
      console.log(`Extracted ${allCandidates.length} candidates`);

      // Step 4: Score candidates
      console.log('Step 4: Scoring candidates...');
      const scoreStart = Date.now();

      const scoredLeads = allCandidates.map(({ candidate, publishedAt }) =>
        this.scorerService.scoreLead(candidate, publishedAt)
      ).sort((a, b) => b.score - a.score);

      stats.leadsScored = scoredLeads.length;

      // Select top leads with deduplication
      const selectedLeads = await this.scorerService.selectTopLeads(
        scoredLeads,
        runConfig.dailyLeadTarget,
        runConfig.leadCooldownDays
      );

      stats.leadsSelected = selectedLeads.length;
      stats.timing.scoreMs = Date.now() - scoreStart;
      console.log(`Selected ${selectedLeads.length} leads after scoring and dedup`);

      // Step 5: Generate emails
      console.log('Step 5: Generating emails...');
      const emailStart = Date.now();

      const emails = await this.emailAgent.generateEmailsBatch(
        selectedLeads,
        runConfig.emailTones
      );

      stats.emailsGenerated = [...emails.values()].filter(e => e !== null).length;
      stats.timing.emailMs = Date.now() - emailStart;
      console.log(`Generated ${stats.emailsGenerated} emails`);

      // Step 6: Store leads and emails
      console.log('Step 6: Storing results...');
      await this.storeLeadsAndEmails(runId, selectedLeads, emails, urlToPageId);

      // Finalize run
      stats.timing.totalMs = Date.now() - startTime;
      await this.updateRun(runId, { status: 'success', stats });

      console.log('Lead finder run complete:', stats);

      return {
        runId,
        status: 'success',
        stats,
        leads: selectedLeads,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stats.errors.push(errorMessage);
      stats.timing.totalMs = Date.now() - startTime;
      
      await this.updateRun(runId, {
        status: 'failed',
        stats,
        errorMessage,
      });

      return {
        runId,
        status: 'failed',
        stats,
        leads: [],
        errorMessage,
      };
    }
  }

  /**
   * Get today's run if it exists
   */
  async getTodayRun(): Promise<{ id: string; status: string; stats: RunStats } | null> {
    const { data, error } = await this.supabase
      .from('lead_finder_runs')
      .select('id, status, stats')
      .eq('run_date', new Date().toISOString().split('T')[0])
      .single();

    if (error || !data) return null;
    return data as { id: string; status: string; stats: RunStats };
  }
}

// Export singleton
export const leadFinderOrchestrator = new LeadFinderOrchestrator();
