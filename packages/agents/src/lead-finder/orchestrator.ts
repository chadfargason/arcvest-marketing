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
import {
  GoogleSearchService,
  SearchResult,
  PageFetcherService,
  FetchedPage,
  LeadScorerService,
  ScoredLead
} from '@arcvest/services';
import { LeadExtractorAgent, type ExtractedCandidate, type ExtractionResult } from './lead-extractor-agent';
import { EmailGeneratorAgent, type EmailTone, type GeneratedEmail } from './email-generator-agent';

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
   * Determine today's rotation parameters (for scheduled/cron jobs)
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
   * Generate random rotation parameters (for manual "Run Now" button)
   * Each run will randomly select city, trigger, and industry for variety
   */
  async generateRandomRotation(): Promise<RunConfig> {
    const config = await this.getConfig();
    
    // Get lists from config
    const geoList = (config['geo_list'] as Array<{ name: string; aliases: string[] }>) || [];
    const triggerList = (config['trigger_list'] as string[]) || ['career_move', 'funding_mna', 'expansion'];
    const industryList = (config['industry_list'] as string[]) || [];
    const emailTones = (config['email_tones'] as EmailTone[]) || ['congratulatory', 'value_first', 'peer_credibility', 'direct_curious'];

    // Randomly select geo
    const geo = geoList.length > 0 
      ? geoList[Math.floor(Math.random() * geoList.length)]
      : { name: 'Houston', aliases: ['Houston'] };

    // Randomly select trigger
    const trigger = triggerList[Math.floor(Math.random() * triggerList.length)] || 'career_move';

    // Randomly select industry (or none)
    const industry = industryList.length > 0 
      ? industryList[Math.floor(Math.random() * industryList.length)]
      : undefined;

    console.log(`🎲 Random rotation: ${geo.name} / ${trigger} / ${industry || 'any industry'}`);

    return {
      geoName: geo.name,
      geoAliases: geo.aliases,
      triggerFocus: trigger,
      industryFocus: industry,
      dailyLeadTarget: (config['daily_lead_target'] as number) || 20,
      candidateTarget: (config['candidate_target'] as number) || 60,
      recencyDays: (config['recency_days'] as number) || 7,
      leadCooldownDays: (config['lead_cooldown_days'] as number) || 0, // Check all leads for manual runs
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
   * Enrich candidates with email addresses by searching for their profiles
   */
  async enrichCandidatesWithEmails(
    candidates: { candidate: ExtractedCandidate; publishedAt: string | null }[]
  ): Promise<void> {
    for (const { candidate } of candidates) {
      try {
        // Build search query to find this person's profile/contact page
        const searchQuery = `"${candidate.fullName}" ${candidate.company || ''} email contact`;
        
        // Search for profile pages
        const searchResults = await this.searchService.search({
          query: searchQuery,
          limit: 5,
          recencyDays: undefined, // No recency filter for profile pages
        });

        // Look for email addresses in search results
        for (const result of searchResults) {
          const emails = this.extractEmailsFromText(result.snippet + ' ' + result.title);
          
          if (emails.length > 0) {
            // Add emails to contact paths if they look legitimate
            for (const email of emails) {
              if (this.isLegitimateEmail(email, candidate)) {
                const existingEmail = candidate.contactPaths.find(
                  cp => cp.type === 'generic_email' && cp.value === email
                );
                
                if (!existingEmail) {
                  candidate.contactPaths.push({
                    type: 'generic_email',
                    value: email,
                    foundOnPage: false, // Found via search, not on original page
                  });
                  console.log(`✅ Found email for ${candidate.fullName}: ${email}`);
                }
              }
            }
          }
          
          // Also check if the URL looks like a profile page
          if (this.isProfileUrl(result.url)) {
            candidate.contactPaths.push({
              type: 'bio_url',
              value: result.url,
              foundOnPage: false,
            });
          }
        }

        // If no emails found via search, use AI to predict likely addresses
        const hasEmail = candidate.contactPaths.some(cp => cp.type === 'generic_email');
        if (!hasEmail) {
          console.log(`🤖 No email found via search, using AI to predict for ${candidate.fullName}...`);
          const predictedEmails = await this.predictEmailAddresses(candidate);
          
          for (const email of predictedEmails) {
            candidate.contactPaths.push({
              type: 'predicted_email',
              value: email,
              foundOnPage: false,
            });
          }
          
          if (predictedEmails.length > 0) {
            console.log(`🎯 AI predicted ${predictedEmails.length} likely emails for ${candidate.fullName}`);
          }
        }
      } catch (error) {
        console.error(`Error enriching ${candidate.fullName}:`, error);
        // Continue with next candidate
      }
    }
  }

  /**
   * Use AI to predict likely email addresses based on common company patterns
   */
  async predictEmailAddresses(
    candidate: ExtractedCandidate
  ): Promise<string[]> {
    if (!candidate.company) {
      return [];
    }

    try {
      // Extract company domain from company name or existing contact paths
      let companyDomain = '';
      
      // First, check if we have a company website in contact paths
      const websiteContact = candidate.contactPaths.find(cp => cp.type === 'company_website' || cp.type === 'company_contact_url');
      if (websiteContact) {
        try {
          const url = new URL(websiteContact.value);
          companyDomain = url.hostname.replace('www.', '');
        } catch {
          // Invalid URL, continue
        }
      }
      
      // If no domain found, try to infer from company name
      if (!companyDomain) {
        companyDomain = candidate.company
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .replace(/inc|corp|corporation|llc|ltd|limited|company|co/g, '') + '.com';
      }

      const prompt = `You are an expert at predicting corporate email addresses based on common patterns.

Given this information:
- Name: ${candidate.fullName}
- Title: ${candidate.title || 'Unknown'}
- Company: ${candidate.company}
- Likely domain: ${companyDomain}

Please provide 2-3 most likely email addresses for this person, based on common corporate email formats:
- FirstLast@domain.com (e.g., JohnSmith@company.com)
- First.Last@domain.com (e.g., John.Smith@company.com)
- FInitialLast@domain.com (e.g., JSmith@company.com)
- First_Last@domain.com (e.g., John_Smith@company.com)

Respond with ONLY a JSON array of email addresses, nothing else. Example:
["john.smith@company.com", "jsmith@company.com", "johnsmith@company.com"]`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Parse JSON response
        const jsonMatch = content.text.match(/\[.*\]/s);
        if (jsonMatch) {
          const predictedEmails = JSON.parse(jsonMatch[0]) as string[];
          console.log(`AI predicted emails for ${candidate.fullName}:`, predictedEmails);
          return predictedEmails.slice(0, 3); // Max 3
        }
      }

      return [];
    } catch (error) {
      console.error(`Error predicting emails for ${candidate.fullName}:`, error);
      return [];
    }
  }

  /**
   * Extract email addresses from text using regex
   */
  private extractEmailsFromText(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex);
    return matches || [];
  }

  /**
   * Check if an email address looks legitimate for this candidate
   */
  private isLegitimateEmail(email: string, candidate: ExtractedCandidate): boolean {
    const emailLower = email.toLowerCase();
    const nameLower = candidate.fullName.toLowerCase();
    const companyLower = (candidate.company || '').toLowerCase();
    
    // Filter out generic/spam emails
    const spamPatterns = ['noreply', 'no-reply', 'info@', 'contact@', 'admin@', 'support@'];
    if (spamPatterns.some(pattern => emailLower.includes(pattern))) {
      return false;
    }
    
    // Prefer emails that contain person's name or company
    const nameParts = nameLower.split(' ').filter(p => p.length > 2);
    const companyParts = companyLower.split(' ').filter(p => p.length > 3);
    
    const hasNamePart = nameParts.some(part => emailLower.includes(part));
    const hasCompanyPart = companyParts.some(part => emailLower.includes(part));
    
    // Accept if it has name OR company reference
    return hasNamePart || hasCompanyPart;
  }

  /**
   * Check if URL looks like a profile/bio page
   */
  private isProfileUrl(url: string): boolean {
    const urlLower = url.toLowerCase();
    const profilePatterns = [
      '/people/', '/team/', '/about/', '/bio/', '/profile/',
      '/leadership/', '/staff/', '/our-team', '/meet-',
      'linkedin.com/in/', 'twitter.com/', 'crunchbase.com/person/'
    ];
    return profilePatterns.some(pattern => urlLower.includes(pattern));
  }

  /**
   * Enrich with colleagues - find similar-rank people at the same company
   */
  async enrichWithColleagues(
    topLeads: ScoredLead[],
    runConfig: RunConfig
  ): Promise<ScoredLead[]> {
    const newColleagues: ScoredLead[] = [];
    
    // Only process Tier A and high Tier B leads
    const worthyLeads = topLeads.filter(l => l.tier === 'A' || (l.tier === 'B' && l.score > 75));
    
    for (const lead of worthyLeads) {
      if (!lead.company) continue;
      
      try {
        // Search for the company's leadership team page
        const companySearchQuery = `"${lead.company}" ${runConfig.geoName} leadership team executives`;
        
        const searchResults = await this.searchService.search({
          query: companySearchQuery,
          limit: 5,
          recencyDays: undefined,
        });
        
        // Look for team/about pages
        const teamPages = searchResults.filter(r => this.isTeamPage(r.url));
        
        if (teamPages.length > 0) {
          // Fetch the team page
          const pages = await this.fetcherService.fetchPages([teamPages[0].url]);
          
          if (pages.length > 0 && !pages[0].error) {
            // Extract colleagues from the team page
            const result = await this.extractorAgent.extractLeads({
              pageTitle: pages[0].pageTitle,
              sourceUrl: pages[0].finalUrl,
              extractedText: pages[0].extractedText,
            });
            
            // Filter for similar rank colleagues
            for (const colleague of result.candidates) {
              // Only keep if same company and similar seniority
              if (colleague.company?.toLowerCase().includes(lead.company.toLowerCase())) {
                const colleagueScored = this.scorerService.scoreLead(colleague, null);
                
                // Only add if similar tier (within 1 tier)
                if (this.isSimilarRank(lead, colleagueScored)) {
                  newColleagues.push(colleagueScored);
                  console.log(`Found colleague: ${colleague.fullName} at ${colleague.company}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error enriching colleagues for ${lead.fullName}:`, error);
      }
    }
    
    return newColleagues;
  }

  /**
   * Check if URL is a team/leadership page
   */
  private isTeamPage(url: string): boolean {
    const urlLower = url.toLowerCase();
    const teamPatterns = [
      '/team', '/leadership', '/about/team', '/our-team', 
      '/executives', '/management', '/people', '/about-us/team'
    ];
    return teamPatterns.some(pattern => urlLower.includes(pattern));
  }

  /**
   * Check if two leads have similar rank/seniority
   */
  private isSimilarRank(lead1: ScoredLead, lead2: ScoredLead): boolean {
    // If both are same tier, definitely similar
    if (lead1.tier === lead2.tier) return true;
    
    // If within 1 tier (A-B or B-C), still similar enough
    const tierOrder = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const tierDiff = Math.abs(tierOrder[lead1.tier] - tierOrder[lead2.tier]);
    
    return tierDiff <= 1;
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

      // Step 4.5: Enrich SELECTED leads with email addresses
      console.log('Step 4.5: Enriching selected leads with email addresses...');
      const enrichStart = Date.now();
      
      // Convert selected leads back to candidate format for enrichment
      const selectedCandidates = selectedLeads.map(lead => ({
        candidate: lead as any as ExtractedCandidate,
        publishedAt: null
      }));
      
      await this.enrichCandidatesWithEmails(selectedCandidates);
      console.log(`Email enrichment completed in ${Date.now() - enrichStart}ms`);

      // Step 4.6: Circle Enrichment - Find colleagues of top prospects
      console.log('Step 4.6: Enriching with colleagues of top prospects...');
      const circleEnrichStart = Date.now();
      const additionalLeads = await this.enrichWithColleagues(selectedLeads.slice(0, 3), runConfig);
      
      // Add new colleagues to selected leads (if not duplicates)
      for (const newLead of additionalLeads) {
        const isDuplicate = selectedLeads.some(existing => 
          this.scorerService.generatePersonKey(existing) === this.scorerService.generatePersonKey(newLead)
        );
        if (!isDuplicate && selectedLeads.length < runConfig.dailyLeadTarget) {
          selectedLeads.push(newLead);
          stats.leadsSelected++;
        }
      }
      
      console.log(`Circle enrichment added ${additionalLeads.length} colleagues in ${Date.now() - circleEnrichStart}ms`);

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

// Lazy-loaded singleton to avoid module-level initialization
let _leadFinderOrchestrator: LeadFinderOrchestrator | null = null;

export function getLeadFinderOrchestrator(): LeadFinderOrchestrator {
  if (!_leadFinderOrchestrator) {
    _leadFinderOrchestrator = new LeadFinderOrchestrator();
  }
  return _leadFinderOrchestrator;
}
