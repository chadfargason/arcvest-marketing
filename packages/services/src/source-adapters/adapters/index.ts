/**
 * Source Adapters Index
 *
 * Exports all source adapters and provides registry initialization.
 */

export { BaseEmailAdapter } from './base-email-adapter';
export { BloombergAdapter } from './bloomberg-adapter';
export { AbnormalReturnsAdapter } from './abnormal-returns-adapter';
export { LarrySwedroeAdapter } from './larry-swedroe-adapter';
export { MichaelGreenAdapter } from './michael-green-adapter';
export { GeneralInboxAdapter } from './general-inbox-adapter';
export { RSSAdapter } from './rss-adapter';

import { getSourceRegistry } from '../registry';
import { BloombergAdapter } from './bloomberg-adapter';
import { AbnormalReturnsAdapter } from './abnormal-returns-adapter';
import { LarrySwedroeAdapter } from './larry-swedroe-adapter';
import { MichaelGreenAdapter } from './michael-green-adapter';
import { GeneralInboxAdapter } from './general-inbox-adapter';
import { RSSAdapter } from './rss-adapter';

/**
 * Initialize all adapters and register them with the registry.
 * Call this once at application startup.
 */
export function initializeAdapters(): void {
  const registry = getSourceRegistry();

  // Register all adapters
  registry.register(new BloombergAdapter());
  registry.register(new AbnormalReturnsAdapter());
  registry.register(new LarrySwedroeAdapter());
  registry.register(new MichaelGreenAdapter());
  registry.register(new GeneralInboxAdapter());
  registry.register(new RSSAdapter());

  console.log(`[SourceAdapters] Registered ${registry.getAll().length} adapters`);
}
