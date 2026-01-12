import cron, { type ScheduledTask } from 'node-cron';
import { createLogger, type Logger } from '@arcvest/shared';
import type { BaseAgent } from './BaseAgent';

export interface Job {
  name: string;
  schedule: string; // Cron expression
  agent: BaseAgent;
  handler: () => Promise<unknown>;
  enabled: boolean;
}

export interface JobConfig {
  name: string;
  schedule: string;
  handler: () => Promise<unknown>;
  enabled?: boolean;
}

export class JobRunner {
  private jobs: Map<string, { job: Job; task: ScheduledTask | null }> = new Map();
  private logger: Logger;
  private isRunning: boolean = false;

  constructor() {
    this.logger = createLogger('job-runner');
  }

  /**
   * Register a job with the runner.
   */
  registerJob(agent: BaseAgent, config: JobConfig): void {
    const job: Job = {
      name: config.name,
      schedule: config.schedule,
      agent,
      handler: config.handler,
      enabled: config.enabled ?? true,
    };

    this.jobs.set(config.name, { job, task: null });
    this.logger.info(`Registered job: ${config.name} (${config.schedule})`);
  }

  /**
   * Start all registered jobs.
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('JobRunner is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting JobRunner');

    for (const [name, { job }] of this.jobs) {
      if (!job.enabled) {
        this.logger.info(`Skipping disabled job: ${name}`);
        continue;
      }

      // Validate cron expression
      if (!cron.validate(job.schedule)) {
        this.logger.error(`Invalid cron expression for job ${name}: ${job.schedule}`);
        continue;
      }

      // Schedule the job
      const task = cron.schedule(job.schedule, async () => {
        await this.executeJob(job);
      });

      this.jobs.set(name, { job, task });
      this.logger.info(`Started job: ${name}`);
    }
  }

  /**
   * Stop all jobs.
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('JobRunner is not running');
      return;
    }

    this.isRunning = false;
    this.logger.info('Stopping JobRunner');

    for (const [name, { task }] of this.jobs) {
      if (task) {
        task.stop();
        this.logger.info(`Stopped job: ${name}`);
      }
    }
  }

  /**
   * Execute a job immediately.
   */
  async executeJobNow(name: string): Promise<void> {
    const entry = this.jobs.get(name);
    if (!entry) {
      throw new Error(`Job not found: ${name}`);
    }

    await this.executeJob(entry.job);
  }

  /**
   * Execute a job with error handling and logging.
   */
  private async executeJob(job: Job): Promise<void> {
    const startedAt = new Date();
    this.logger.info(`Executing job: ${job.name}`);

    try {
      // Log job start
      await this.logJobStart(job, startedAt);

      // Execute the handler
      await job.handler();

      // Log job completion
      await this.logJobComplete(job, startedAt);

      this.logger.info(`Job completed: ${job.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Job failed: ${job.name} - ${message}`);

      // Log job failure
      await this.logJobFailed(job, startedAt, message);
    }
  }

  /**
   * Log job start.
   */
  private async logJobStart(job: Job, startedAt: Date): Promise<void> {
    // @ts-expect-error - accessing protected method
    await job.agent.logJobExecution(job.name, 'started', startedAt);
  }

  /**
   * Log job completion.
   */
  private async logJobComplete(job: Job, startedAt: Date): Promise<void> {
    // @ts-expect-error - accessing protected method
    await job.agent.logJobExecution(job.name, 'completed', startedAt);
  }

  /**
   * Log job failure.
   */
  private async logJobFailed(job: Job, startedAt: Date, errorMessage: string): Promise<void> {
    // @ts-expect-error - accessing protected method
    await job.agent.logJobExecution(job.name, 'failed', startedAt, errorMessage);
  }

  /**
   * Get the status of all jobs.
   */
  getStatus(): { name: string; schedule: string; enabled: boolean; running: boolean }[] {
    return Array.from(this.jobs.values()).map(({ job, task }) => ({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      running: task !== null,
    }));
  }

  /**
   * Enable a job.
   */
  enableJob(name: string): void {
    const entry = this.jobs.get(name);
    if (!entry) {
      throw new Error(`Job not found: ${name}`);
    }

    entry.job.enabled = true;

    if (this.isRunning && !entry.task) {
      const task = cron.schedule(entry.job.schedule, async () => {
        await this.executeJob(entry.job);
      });
      this.jobs.set(name, { ...entry, task });
    }

    this.logger.info(`Enabled job: ${name}`);
  }

  /**
   * Disable a job.
   */
  disableJob(name: string): void {
    const entry = this.jobs.get(name);
    if (!entry) {
      throw new Error(`Job not found: ${name}`);
    }

    entry.job.enabled = false;

    if (entry.task) {
      entry.task.stop();
      this.jobs.set(name, { ...entry, task: null });
    }

    this.logger.info(`Disabled job: ${name}`);
  }
}

// Export singleton instance
export const jobRunner = new JobRunner();
