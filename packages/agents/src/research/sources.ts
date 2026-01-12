/**
 * Research Sources Configuration
 *
 * Defines competitors, industry RSS feeds, and regulatory sources to monitor.
 */

export interface Competitor {
  name: string;
  domain: string;
  type: 'direct' | 'indirect' | 'aspirational';
  monitorBlog: boolean;
  monitorSocial: boolean;
  linkedInUrl?: string;
  twitterHandle?: string;
}

export interface RSSFeed {
  name: string;
  url: string;
  category: 'industry' | 'regulatory' | 'market' | 'technology';
  priority: 'high' | 'medium' | 'low';
}

export interface MonitoringConfig {
  competitors: Competitor[];
  rssFeeds: RSSFeed[];
  keywords: string[];
  excludeKeywords: string[];
}

/**
 * Direct competitors - other fee-only RIAs targeting similar clients
 */
export const directCompetitors: Competitor[] = [
  {
    name: 'Example Advisory Firm',
    domain: 'exampleadvisoryfirm.com',
    type: 'direct',
    monitorBlog: true,
    monitorSocial: true,
  },
  // Add actual competitors here
];

/**
 * Indirect competitors - wirehouses, robo-advisors, etc.
 */
export const indirectCompetitors: Competitor[] = [
  {
    name: 'Vanguard Personal Advisor Services',
    domain: 'investor.vanguard.com',
    type: 'indirect',
    monitorBlog: true,
    monitorSocial: false,
  },
  {
    name: 'Betterment',
    domain: 'betterment.com',
    type: 'indirect',
    monitorBlog: true,
    monitorSocial: true,
    twitterHandle: 'betterment',
  },
  {
    name: 'Wealthfront',
    domain: 'wealthfront.com',
    type: 'indirect',
    monitorBlog: true,
    monitorSocial: true,
    twitterHandle: 'wealthfront',
  },
];

/**
 * Aspirational competitors - firms to learn from
 */
export const aspirationalCompetitors: Competitor[] = [
  {
    name: 'Kitces.com',
    domain: 'kitces.com',
    type: 'aspirational',
    monitorBlog: true,
    monitorSocial: true,
    twitterHandle: 'MichaelKitces',
  },
];

/**
 * Industry RSS feeds
 */
export const industryFeeds: RSSFeed[] = [
  // Financial Planning News
  {
    name: 'Financial Planning Magazine',
    url: 'https://www.financial-planning.com/feed',
    category: 'industry',
    priority: 'high',
  },
  {
    name: 'InvestmentNews',
    url: 'https://www.investmentnews.com/feed',
    category: 'industry',
    priority: 'high',
  },
  {
    name: 'ThinkAdvisor',
    url: 'https://www.thinkadvisor.com/feed/',
    category: 'industry',
    priority: 'medium',
  },
  {
    name: 'Advisor Perspectives',
    url: 'https://www.advisorperspectives.com/rss',
    category: 'industry',
    priority: 'medium',
  },

  // Regulatory News
  {
    name: 'SEC Press Releases',
    url: 'https://www.sec.gov/rss/news/press.xml',
    category: 'regulatory',
    priority: 'high',
  },
  {
    name: 'FINRA News',
    url: 'https://www.finra.org/rss-feeds/news-releases',
    category: 'regulatory',
    priority: 'high',
  },

  // Market News
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'market',
    priority: 'low',
  },

  // Technology
  {
    name: 'WealthManagement.com Tech',
    url: 'https://www.wealthmanagement.com/rss.xml',
    category: 'technology',
    priority: 'medium',
  },
];

/**
 * Keywords to look for in content
 */
export const monitoringKeywords: string[] = [
  // Service keywords
  'fee-only',
  'fiduciary',
  'retirement planning',
  'wealth management',
  'financial advisor',
  'RIA',

  // Regulatory
  'SEC marketing rule',
  'compliance',
  'fiduciary rule',
  'best interest',

  // Market trends
  'robo-advisor',
  'hybrid advisor',
  'digital advice',

  // Client segments
  'pre-retirees',
  'retirement income',
  'estate planning',
];

/**
 * Keywords to exclude (reduce noise)
 */
export const excludeKeywords: string[] = [
  'cryptocurrency',
  'meme stock',
  'day trading',
  'forex',
];

/**
 * Get full monitoring configuration
 */
export function getMonitoringConfig(): MonitoringConfig {
  return {
    competitors: [
      ...directCompetitors,
      ...indirectCompetitors,
      ...aspirationalCompetitors,
    ],
    rssFeeds: industryFeeds,
    keywords: monitoringKeywords,
    excludeKeywords,
  };
}

/**
 * Get competitors by type
 */
export function getCompetitorsByType(type: 'direct' | 'indirect' | 'aspirational'): Competitor[] {
  switch (type) {
    case 'direct':
      return directCompetitors;
    case 'indirect':
      return indirectCompetitors;
    case 'aspirational':
      return aspirationalCompetitors;
    default:
      return [];
  }
}

/**
 * Get feeds by category
 */
export function getFeedsByCategory(category: RSSFeed['category']): RSSFeed[] {
  return industryFeeds.filter((feed) => feed.category === category);
}

/**
 * Get high priority feeds
 */
export function getHighPriorityFeeds(): RSSFeed[] {
  return industryFeeds.filter((feed) => feed.priority === 'high');
}
