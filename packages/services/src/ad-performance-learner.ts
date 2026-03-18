/**
 * Ad Performance Learner
 *
 * Queries ad performance data from the database and builds context
 * for the RSA generation pipeline to learn from winners and losers.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface PerformanceContext {
  topHeadlines: Array<{
    text: string;
    type: string;
    performanceLabel: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  lowHeadlines: Array<{
    text: string;
    type: string;
    performanceLabel: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  topDescriptions: Array<{
    text: string;
    performanceLabel: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  lowDescriptions: Array<{
    text: string;
    performanceLabel: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  topSearchTerms: Array<{
    term: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  benchmarks: {
    avgCtr: number;
    avgCpc: number;
    avgConversionRate: number;
    totalImpressions: number;
    totalClicks: number;
  };
  personaVoiceInsights: Array<{
    personaId: string;
    voiceId: string;
    ctr: number;
    impressions: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
}

export class AdPerformanceLearner {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async buildContext(personaId?: string, voiceId?: string): Promise<PerformanceContext> {
    const [
      topHeadlines,
      lowHeadlines,
      topDescriptions,
      lowDescriptions,
      topSearchTerms,
      benchmarks,
      personaVoiceInsights,
    ] = await Promise.all([
      this.getTopHeadlines(),
      this.getLowHeadlines(),
      this.getTopDescriptions(),
      this.getLowDescriptions(),
      this.getTopSearchTerms(),
      this.getBenchmarks(),
      this.getPersonaVoiceInsights(personaId, voiceId),
    ]);

    return {
      topHeadlines,
      lowHeadlines,
      topDescriptions,
      lowDescriptions,
      topSearchTerms,
      benchmarks,
      personaVoiceInsights,
    };
  }

  private async getTopHeadlines() {
    const { data } = await this.supabase
      .from('rsa_headlines')
      .select('text, headline_type, performance_label, impressions, clicks, ctr')
      .in('performance_label', ['BEST', 'GOOD'])
      .gt('impressions', 100)
      .order('ctr', { ascending: false })
      .limit(20);

    return (data || []).map(h => ({
      text: h.text,
      type: h.headline_type || 'unknown',
      performanceLabel: h.performance_label,
      impressions: h.impressions,
      clicks: h.clicks,
      ctr: h.ctr,
    }));
  }

  private async getLowHeadlines() {
    const { data } = await this.supabase
      .from('rsa_headlines')
      .select('text, headline_type, performance_label, impressions, clicks, ctr')
      .eq('performance_label', 'LOW')
      .gt('impressions', 100)
      .order('impressions', { ascending: false })
      .limit(10);

    return (data || []).map(h => ({
      text: h.text,
      type: h.headline_type || 'unknown',
      performanceLabel: h.performance_label,
      impressions: h.impressions,
      clicks: h.clicks,
      ctr: h.ctr,
    }));
  }

  private async getTopDescriptions() {
    const { data } = await this.supabase
      .from('rsa_descriptions')
      .select('text, performance_label, impressions, clicks, ctr')
      .in('performance_label', ['BEST', 'GOOD'])
      .gt('impressions', 100)
      .order('ctr', { ascending: false })
      .limit(10);

    return (data || []).map(d => ({
      text: d.text,
      performanceLabel: d.performance_label,
      impressions: d.impressions,
      clicks: d.clicks,
      ctr: d.ctr,
    }));
  }

  private async getLowDescriptions() {
    const { data } = await this.supabase
      .from('rsa_descriptions')
      .select('text, performance_label, impressions, clicks, ctr')
      .eq('performance_label', 'LOW')
      .gt('impressions', 100)
      .order('impressions', { ascending: false })
      .limit(5);

    return (data || []).map(d => ({
      text: d.text,
      performanceLabel: d.performance_label,
      impressions: d.impressions,
      clicks: d.clicks,
      ctr: d.ctr,
    }));
  }

  private async getTopSearchTerms() {
    const { data } = await this.supabase
      .from('search_terms')
      .select('search_term, impressions, clicks, ctr')
      .gt('clicks', 0)
      .order('clicks', { ascending: false })
      .limit(30);

    return (data || []).map(s => ({
      term: s.search_term,
      impressions: s.impressions,
      clicks: s.clicks,
      ctr: s.ctr,
    }));
  }

  private async getBenchmarks() {
    // Get last 30 days of daily metrics for benchmarks
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data } = await this.supabase
      .from('daily_metrics')
      .select('ad_impressions, ad_clicks, ad_cost')
      .gte('date', thirtyDaysAgo);

    if (!data || data.length === 0) {
      return { avgCtr: 0, avgCpc: 0, avgConversionRate: 0, totalImpressions: 0, totalClicks: 0 };
    }

    const totalImpressions = data.reduce((sum, d) => sum + (d.ad_impressions || 0), 0);
    const totalClicks = data.reduce((sum, d) => sum + (d.ad_clicks || 0), 0);
    const totalCost = data.reduce((sum, d) => sum + (d.ad_cost || 0), 0);

    return {
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
      avgConversionRate: 0, // Would need conversion data
      totalImpressions,
      totalClicks,
    };
  }

  private async getPersonaVoiceInsights(personaId?: string, voiceId?: string) {
    let query = this.supabase
      .from('persona_voice_performance')
      .select('persona_id, voice_id, ctr, impressions, week_start')
      .order('week_start', { ascending: false })
      .limit(50);

    if (personaId) query = query.eq('persona_id', personaId);
    if (voiceId) query = query.eq('voice_id', voiceId);

    const { data } = await query;

    if (!data || data.length === 0) return [];

    // Group by persona+voice and calculate trend
    const grouped = new Map<string, typeof data>();
    for (const row of data) {
      const key = `${row.persona_id}:${row.voice_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    return Array.from(grouped.entries()).map(([key, rows]) => {
      const [pid, vid] = key.split(':');
      const latest = rows[0];
      const previous = rows.length > 1 ? rows[1] : null;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (previous) {
        const diff = latest.ctr - previous.ctr;
        if (diff > 0.5) trend = 'improving';
        else if (diff < -0.5) trend = 'declining';
      }

      return {
        personaId: pid,
        voiceId: vid,
        ctr: latest.ctr,
        impressions: latest.impressions,
        trend,
      };
    });
  }

  /**
   * Aggregate persona/voice performance for the current week
   * Called by ads-sync cron after syncing asset data
   */
  async aggregateWeeklyPerformance(): Promise<void> {
    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Get performance by persona/voice from rsa_asset_groups joined with campaigns
    const { data: groups } = await this.supabase
      .from('rsa_asset_groups')
      .select('persona_id, voice_id')
      .eq('status', 'active');

    if (!groups) return;

    const combos = new Set(groups.map(g => `${g.persona_id}:${g.voice_id}`));

    for (const combo of combos) {
      const [personaId, voiceId] = combo.split(':');

      // Get headlines for this persona/voice
      const { data: headlines } = await this.supabase
        .from('rsa_headlines')
        .select('text, impressions, clicks, ctr, performance_label, asset_id')
        .gt('impressions', 0);

      // Sum up metrics
      const totalImpressions = (headlines || []).reduce((s, h) => s + h.impressions, 0);
      const totalClicks = (headlines || []).reduce((s, h) => s + h.clicks, 0);

      const topHeadlines = (headlines || [])
        .filter(h => h.performance_label === 'BEST' || h.performance_label === 'GOOD')
        .sort((a, b) => b.ctr - a.ctr)
        .slice(0, 5)
        .map(h => ({ text: h.text, ctr: h.ctr }));

      await this.supabase.from('persona_voice_performance').upsert({
        persona_id: personaId,
        voice_id: voiceId,
        week_start: weekStartStr,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        top_headlines: topHeadlines,
      }, {
        onConflict: 'persona_id,voice_id,week_start',
      });
    }

    console.log('[AdPerformanceLearner] Weekly performance aggregated');
  }
}

// Singleton
let learnerInstance: AdPerformanceLearner | null = null;

export function getAdPerformanceLearner(): AdPerformanceLearner {
  if (!learnerInstance) {
    learnerInstance = new AdPerformanceLearner();
  }
  return learnerInstance;
}
