/**
 * Agents Package Tests
 *
 * Tests for agent utilities and configuration that don't require external connections.
 */

import { describe, it, expect } from 'vitest';
import {
  getMonitoringConfig,
  getHighPriorityFeeds,
  directCompetitors,
  indirectCompetitors,
  aspirationalCompetitors,
  industryFeeds,
  monitoringKeywords,
  excludeKeywords,
  getCompetitorsByType,
  getFeedsByCategory,
} from '../research/sources';

describe('Research Sources', () => {
  describe('getMonitoringConfig', () => {
    it('should return complete monitoring config', () => {
      const config = getMonitoringConfig();

      expect(config).toBeDefined();
      expect(config.competitors).toBeDefined();
      expect(config.rssFeeds).toBeDefined();
      expect(config.keywords).toBeDefined();
      expect(config.excludeKeywords).toBeDefined();
    });

    it('should include all competitor types', () => {
      const config = getMonitoringConfig();

      expect(config.competitors.length).toBe(
        directCompetitors.length + indirectCompetitors.length + aspirationalCompetitors.length
      );
    });

    it('should include all RSS feeds', () => {
      const config = getMonitoringConfig();
      expect(config.rssFeeds).toEqual(industryFeeds);
    });
  });

  describe('Competitors', () => {
    it('should have valid competitor structure', () => {
      const allCompetitors = [...directCompetitors, ...indirectCompetitors, ...aspirationalCompetitors];

      allCompetitors.forEach((competitor) => {
        expect(competitor.name).toBeDefined();
        expect(competitor.domain).toBeDefined();
        expect(['direct', 'indirect', 'aspirational']).toContain(competitor.type);
        expect(typeof competitor.monitorBlog).toBe('boolean');
        expect(typeof competitor.monitorSocial).toBe('boolean');
      });
    });

    it('should get competitors by type', () => {
      expect(getCompetitorsByType('direct')).toEqual(directCompetitors);
      expect(getCompetitorsByType('indirect')).toEqual(indirectCompetitors);
      expect(getCompetitorsByType('aspirational')).toEqual(aspirationalCompetitors);
    });
  });

  describe('RSS Feeds', () => {
    it('should have valid feed structure', () => {
      industryFeeds.forEach((feed) => {
        expect(feed.name).toBeDefined();
        expect(feed.url).toBeDefined();
        expect(feed.url).toMatch(/^https?:\/\//);
        expect(['industry', 'regulatory', 'market', 'technology']).toContain(feed.category);
        expect(['high', 'medium', 'low']).toContain(feed.priority);
      });
    });

    it('should get high priority feeds', () => {
      const highPriority = getHighPriorityFeeds();

      expect(highPriority.length).toBeGreaterThan(0);
      highPriority.forEach((feed) => {
        expect(feed.priority).toBe('high');
      });
    });

    it('should get feeds by category', () => {
      const regulatoryFeeds = getFeedsByCategory('regulatory');

      expect(regulatoryFeeds.length).toBeGreaterThan(0);
      regulatoryFeeds.forEach((feed) => {
        expect(feed.category).toBe('regulatory');
      });
    });
  });

  describe('Keywords', () => {
    it('should have monitoring keywords', () => {
      expect(monitoringKeywords.length).toBeGreaterThan(0);
      expect(monitoringKeywords).toContain('fee-only');
      expect(monitoringKeywords).toContain('fiduciary');
    });

    it('should have exclude keywords', () => {
      expect(excludeKeywords.length).toBeGreaterThan(0);
    });

    it('should not overlap keywords', () => {
      const overlap = monitoringKeywords.filter((k) => excludeKeywords.includes(k));
      expect(overlap.length).toBe(0);
    });
  });
});

describe('Module Exports', () => {
  it('should export base classes', async () => {
    const { BaseAgent, JobRunner, jobRunner } = await import('../index');

    expect(BaseAgent).toBeDefined();
    expect(JobRunner).toBeDefined();
    expect(jobRunner).toBeDefined();
  });

  it('should export agent classes', async () => {
    const {
      OrchestratorAgent,
      ContentAgent,
      CreativeAgent,
      PaidMediaAgent,
      SEOAgent,
      AnalyticsAgent,
      ResearchAgent,
    } = await import('../index');

    expect(OrchestratorAgent).toBeDefined();
    expect(ContentAgent).toBeDefined();
    expect(CreativeAgent).toBeDefined();
    expect(PaidMediaAgent).toBeDefined();
    expect(SEOAgent).toBeDefined();
    expect(AnalyticsAgent).toBeDefined();
    expect(ResearchAgent).toBeDefined();
  });

  it('should export client utilities', async () => {
    const { ClaudeClient, WordPressClient, GA4Client } = await import('../index');

    expect(ClaudeClient).toBeDefined();
    expect(WordPressClient).toBeDefined();
    expect(GA4Client).toBeDefined();
  });

  it('should export research utilities', async () => {
    const { getMonitoringConfig, getHighPriorityFeeds } = await import('../index');

    expect(getMonitoringConfig).toBeDefined();
    expect(typeof getMonitoringConfig).toBe('function');
    expect(getHighPriorityFeeds).toBeDefined();
    expect(typeof getHighPriorityFeeds).toBe('function');
  });

  it('should export Gmail sync utilities', async () => {
    const { runGmailSync, gmailSyncHandler, checkGmailConnection } = await import('../index');

    expect(runGmailSync).toBeDefined();
    expect(gmailSyncHandler).toBeDefined();
    expect(checkGmailConnection).toBeDefined();
  });
});

describe('JobRunner', () => {
  it('should track job status', async () => {
    const { JobRunner } = await import('../index');
    const runner = new JobRunner();

    const status = runner.getStatus();
    expect(Array.isArray(status)).toBe(true);
    expect(status.length).toBe(0); // No jobs registered yet
  });
});
