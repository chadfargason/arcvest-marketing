/**
 * Daily Selection Service
 *
 * Selects the top ideas for a given day's content pipeline.
 * Ensures diversity of sources and minimum quality threshold.
 */

import { createLogger } from '@arcvest/shared';
import { getSupabase } from '../supabase';

const logger = createLogger('daily-selection');

interface SelectionConfig {
  targetCount: number;      // How many ideas to select (default: 8)
  minScore: number;         // Minimum score threshold (default: 60)
  maxPerSource: number;     // Max ideas from same source (default: 2)
  maxPerCategory: number;   // Max ideas from same content category (default: 3)
  date?: Date;              // Date to select for (default: today)
}

interface SelectionResult {
  success: boolean;
  selectedCount: number;
  selectedIdeas: Array<{
    id: string;
    title: string;
    sourceName: string;
    score: number;
    rank: number;
  }>;
  sourceBreakdown: Record<string, number>;
  error?: string;
}

export class DailySelectionService {
  private _supabase: any = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabase();
    }
    return this._supabase;
  }

  /**
   * Select top ideas for today (or specified date)
   */
  async selectDaily(config?: Partial<SelectionConfig>): Promise<SelectionResult> {
    const {
      targetCount = 8,
      minScore = 60,
      maxPerSource = 2,
      maxPerCategory = 3,
      date = new Date(),
    } = config || {};

    const dateStr = date.toISOString().split('T')[0] || '';

    try {
      // Get existing run if any (for tracking purposes, but don't block)
      const { data: existingRun } = await this.supabase
        .from('selection_runs')
        .select('id, ideas_selected')
        .eq('run_date', dateStr)
        .single();

      // Create or update selection run record (allow multiple runs per day)
      const runId = existingRun?.id || undefined;

      // Start selection
      await this.updateSelectionRun(runId, dateStr, {
        status: 'selecting',
        selection_started_at: new Date().toISOString(),
      });

      // Fetch scored ideas that haven't been selected yet
      const { data: scoredIdeas, error: fetchError } = await this.supabase
        .from('idea_queue')
        .select('id, title, source_name, source_id, relevance_score, suggested_angle, content_category')
        .eq('status', 'scored')
        .gte('relevance_score', minScore)
        .order('relevance_score', { ascending: false })
        .limit(100);

      if (fetchError) {
        throw fetchError;
      }

      if (!scoredIdeas || scoredIdeas.length === 0) {
        logger.warn('No scored ideas available for selection');
        await this.updateSelectionRun(runId, dateStr, {
          status: 'completed',
          ideas_selected: 0,
          selection_completed_at: new Date().toISOString(),
          summary: 'No scored ideas met the minimum threshold',
        });
        return {
          success: true,
          selectedCount: 0,
          selectedIdeas: [],
          sourceBreakdown: {},
        };
      }

      // Select with source AND category diversity
      // Pass 1: Pick 1 idea per category (guarantees variety)
      // Pass 2: Fill remaining slots by score
      const selectedIdeas: Array<{
        id: string;
        title: string;
        sourceName: string;
        score: number;
        rank: number;
      }> = [];
      const sourceCount: Record<string, number> = {};
      const categoryCount: Record<string, number> = {};
      const selectedIds = new Set<string>();

      const categories = ['market_commentary', 'macro_capital_flows', 'real_economy', 'investor_strategies'];

      // Pass 1: Pick best idea from each category (if available)
      for (const cat of categories) {
        if (selectedIdeas.length >= targetCount) break;

        const bestInCategory = scoredIdeas.find(idea => {
          if (selectedIds.has(idea.id)) return false;
          if ((idea.content_category || 'investor_strategies') !== cat) return false;
          const sourceKey = idea.source_id || idea.source_name;
          if ((sourceCount[sourceKey] || 0) >= maxPerSource) return false;
          return true;
        });

        if (bestInCategory) {
          const sourceKey = bestInCategory.source_id || bestInCategory.source_name;
          const cat = bestInCategory.content_category || 'investor_strategies';
          selectedIdeas.push({
            id: bestInCategory.id,
            title: bestInCategory.title,
            sourceName: bestInCategory.source_name,
            score: bestInCategory.relevance_score || 0,
            rank: selectedIdeas.length + 1,
          });
          selectedIds.add(bestInCategory.id);
          sourceCount[sourceKey] = (sourceCount[sourceKey] || 0) + 1;
          categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        }
      }

      // Pass 2: Fill remaining slots by score, respecting source and category limits
      for (const idea of scoredIdeas) {
        if (selectedIdeas.length >= targetCount) break;
        if (selectedIds.has(idea.id)) continue;

        const sourceKey = idea.source_id || idea.source_name;
        if ((sourceCount[sourceKey] || 0) >= maxPerSource) continue;

        const cat = idea.content_category || 'investor_strategies';
        if ((categoryCount[cat] || 0) >= maxPerCategory) continue;

        selectedIdeas.push({
          id: idea.id,
          title: idea.title,
          sourceName: idea.source_name,
          score: idea.relevance_score || 0,
          rank: selectedIdeas.length + 1,
        });
        selectedIds.add(idea.id);
        sourceCount[sourceKey] = (sourceCount[sourceKey] || 0) + 1;
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }

      // Update selected ideas in database
      const selectedIdArray = selectedIdeas.map(i => i.id);
      for (const idea of selectedIdeas) {
        await this.supabase
          .from('idea_queue')
          .update({
            status: 'selected',
            selected_for_date: dateStr,
            selection_rank: idea.rank,
            updated_at: new Date().toISOString(),
          })
          .eq('id', idea.id);
      }

      // Calculate stats
      const scores = selectedIdeas.map(i => i.score);
      const scoreStats = {
        min: Math.min(...scores),
        max: Math.max(...scores),
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      };

      // Update selection run
      await this.updateSelectionRun(runId, dateStr, {
        status: 'completed',
        ideas_scored: scoredIdeas.length,
        ideas_selected: selectedIdeas.length,
        selected_idea_ids: selectedIdArray,
        source_breakdown: sourceCount,
        category_breakdown: categoryCount,
        score_stats: scoreStats,
        selection_completed_at: new Date().toISOString(),
        summary: `Selected ${selectedIdeas.length} ideas from ${Object.keys(sourceCount).length} sources. Avg score: ${scoreStats.avg}`,
      });

      logger.info(`Selection complete: ${selectedIdeas.length} ideas from ${Object.keys(sourceCount).length} sources`);

      return {
        success: true,
        selectedCount: selectedIdeas.length,
        selectedIdeas,
        sourceBreakdown: sourceCount,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Selection failed', error);

      await this.updateSelectionRun(undefined, dateStr, {
        status: 'failed',
        error_message: errorMsg,
      });

      return {
        success: false,
        selectedCount: 0,
        selectedIdeas: [],
        sourceBreakdown: {},
        error: errorMsg,
      };
    }
  }

  /**
   * Get selected ideas for a date
   */
  async getSelectedIdeas(date?: Date): Promise<Array<{
    id: string;
    title: string;
    sourceName: string;
    score: number;
    rank: number;
    suggestedAngle: string;
  }>> {
    const dateStr = (date || new Date()).toISOString().split('T')[0] || '';

    const { data, error } = await this.supabase
      .from('idea_queue')
      .select('id, title, source_name, relevance_score, selection_rank, suggested_angle')
      .eq('selected_for_date', dateStr)
      .order('selection_rank', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map(idea => ({
      id: idea.id,
      title: idea.title,
      sourceName: idea.source_name,
      score: idea.relevance_score || 0,
      rank: idea.selection_rank || 0,
      suggestedAngle: idea.suggested_angle || '',
    }));
  }

  /**
   * Update or create selection run record
   */
  private async updateSelectionRun(
    runId: string | undefined,
    dateStr: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    if (runId) {
      await this.supabase
        .from('selection_runs')
        .update(updates)
        .eq('id', runId);
    } else {
      await this.supabase
        .from('selection_runs')
        .upsert({
          run_date: dateStr,
          ...updates,
        });
    }
  }
}

// Singleton
let selectionInstance: DailySelectionService | null = null;

export function getDailySelectionService(): DailySelectionService {
  if (!selectionInstance) {
    selectionInstance = new DailySelectionService();
  }
  return selectionInstance;
}
