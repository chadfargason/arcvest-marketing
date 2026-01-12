/**
 * Bloomberg Email Integration
 *
 * Scans Gmail for Bloomberg newsletters and queues relevant content
 * for the multi-AI content pipeline.
 */

export {
  BloombergProcessor,
  getBloombergProcessor,
  type BloombergArticle,
  type BloombergScanResult,
} from './bloomberg-processor';
