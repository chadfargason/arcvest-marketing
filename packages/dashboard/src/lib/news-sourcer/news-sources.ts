/**
 * News Sources Configuration for Module 1A
 *
 * RSS feeds and news sources to scan for relevant content.
 * Add/remove sources as needed.
 */

export interface NewsSource {
  id: string;
  name: string;
  type: 'rss' | 'api';
  url: string;
  category: 'markets' | 'retirement' | 'tax' | 'regulatory' | 'general_finance';
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
}

export const NEWS_SOURCES: NewsSource[] = [
  // Market News
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    type: 'rss',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'markets',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'marketwatch',
    name: 'MarketWatch',
    type: 'rss',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'markets',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'cnbc-investing',
    name: 'CNBC Investing',
    type: 'rss',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069',
    category: 'markets',
    priority: 'medium',
    enabled: true,
  },

  // Retirement & Personal Finance
  {
    id: 'morningstar',
    name: 'Morningstar',
    type: 'rss',
    url: 'https://www.morningstar.com/feeds/rss/articles',
    category: 'retirement',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'kiplinger-retirement',
    name: 'Kiplinger Retirement',
    type: 'rss',
    url: 'https://www.kiplinger.com/feed/retirement',
    category: 'retirement',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'nerdwallet',
    name: 'NerdWallet',
    type: 'rss',
    url: 'https://www.nerdwallet.com/blog/feed/',
    category: 'general_finance',
    priority: 'medium',
    enabled: true,
  },

  // Tax & Regulatory
  {
    id: 'irs-news',
    name: 'IRS News',
    type: 'rss',
    url: 'https://www.irs.gov/newsroom/rss-feeds',
    category: 'tax',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'sec-news',
    name: 'SEC Press Releases',
    type: 'rss',
    url: 'https://www.sec.gov/news/pressreleases.rss',
    category: 'regulatory',
    priority: 'medium',
    enabled: true,
  },

  // Social Security & Medicare
  {
    id: 'ssa-news',
    name: 'Social Security News',
    type: 'rss',
    url: 'https://www.ssa.gov/rss/rss-feed.xml',
    category: 'retirement',
    priority: 'high',
    enabled: true,
  },

  // Investment News
  {
    id: 'investopedia',
    name: 'Investopedia',
    type: 'rss',
    url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles',
    category: 'general_finance',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'seeking-alpha',
    name: 'Seeking Alpha',
    type: 'rss',
    url: 'https://seekingalpha.com/feed.xml',
    category: 'markets',
    priority: 'medium',
    enabled: true,
  },

  // Reuters Business
  {
    id: 'reuters-business',
    name: 'Reuters Business',
    type: 'rss',
    url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
    category: 'markets',
    priority: 'high',
    enabled: true,
  },
];

// Topics that align with ArcVest content strategy
export const RELEVANT_TOPICS = [
  'market news',
  'market commentary',
  'asset class returns',
  'quarterly performance',
  'annual performance',
  'retirement planning',
  'retirement income',
  'Social Security',
  'Medicare',
  'tax law changes',
  'tax planning',
  'estate planning',
  'investment strategy',
  'portfolio management',
  'financial planning',
  'wealth management',
  '401k',
  'IRA',
  'RMD',
  'Roth conversion',
  'asset allocation',
  'bond yields',
  'interest rates',
  'inflation',
  'Fed policy',
  'economic outlook',
];

// Topics to avoid or deprioritize
export const TOPICS_TO_AVOID = [
  'individual stock picks',
  'crypto',
  'meme stocks',
  'day trading',
  'options trading',
  'penny stocks',
  'get rich quick',
  'celebrity finance',
  'NFT',
  'gambling',
];

export function getEnabledSources(): NewsSource[] {
  return NEWS_SOURCES.filter(source => source.enabled);
}

export function getSourcesByCategory(category: NewsSource['category']): NewsSource[] {
  return NEWS_SOURCES.filter(source => source.enabled && source.category === category);
}

export function getHighPrioritySources(): NewsSource[] {
  return NEWS_SOURCES.filter(source => source.enabled && source.priority === 'high');
}
