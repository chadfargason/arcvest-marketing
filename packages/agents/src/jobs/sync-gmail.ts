/**
 * Gmail Sync Job
 *
 * Periodically syncs Gmail inbox and processes new messages.
 * Creates contacts and interactions from inbound emails.
 */

import { createLogger } from '@arcvest/shared';
import { GmailService, type GmailSyncResult } from '@arcvest/services';

const logger = createLogger('gmail-sync-job');

export interface GmailSyncJobOptions {
  maxMessages?: number;
  skipProcessing?: boolean;
}

/**
 * Run Gmail sync job.
 */
export async function runGmailSync(options: GmailSyncJobOptions = {}): Promise<GmailSyncResult> {
  logger.info('Starting Gmail sync job', options);

  const gmailService = new GmailService();

  // Check if Gmail is connected
  const isConnected = await gmailService.isConnected();
  if (!isConnected) {
    logger.warn('Gmail not connected, skipping sync');
    return {
      processed: 0,
      newContacts: 0,
      newInteractions: 0,
      errors: ['Gmail not connected'],
    };
  }

  try {
    // Run sync and process
    const result = await gmailService.syncAndProcess();

    // Log results
    if (result.processed > 0) {
      logger.info('Gmail sync completed', {
        processed: result.processed,
        newContacts: result.newContacts,
        newInteractions: result.newInteractions,
      });
    }

    if (result.errors.length > 0) {
      logger.warn('Gmail sync had errors', { errors: result.errors });
    }

    return result;
  } catch (error) {
    logger.error('Gmail sync job failed', error);
    throw error;
  }
}

/**
 * Gmail Job Handler for JobRunner.
 */
export async function gmailSyncHandler(): Promise<void> {
  await runGmailSync();
}

/**
 * Check Gmail connection status.
 */
export async function checkGmailConnection(): Promise<{
  connected: boolean;
  email?: string;
}> {
  const gmailService = new GmailService();

  try {
    const isConnected = await gmailService.isConnected();
    if (!isConnected) {
      return { connected: false };
    }

    const profile = await gmailService.getProfile();
    return {
      connected: true,
      email: profile.emailAddress,
    };
  } catch {
    return { connected: false };
  }
}
