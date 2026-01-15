import { createClient, SupabaseClient } from '@supabase/supabase-js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  job_id?: string;
  job_type: string;
  level: LogLevel;
  message: string;
  step?: string;
  details?: Record<string, unknown>;
  duration_ms?: number;
}

/**
 * Pipeline Logger - Persists logs to Supabase for debugging overnight jobs
 *
 * Usage:
 *   const logger = new PipelineLogger('content_pipeline', jobId);
 *   logger.info('Starting pipeline', 'start');
 *   logger.info('Claude draft complete', 'claude_draft', { tokens: 1500 });
 *   logger.error('API failed', 'chatgpt_edit', { error: err.message });
 */
export class PipelineLogger {
  private supabase: SupabaseClient | null = null;
  private jobType: string;
  private jobId?: string;
  private startTime: number;
  private stepStartTime: number;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(jobType: string, jobId?: string) {
    this.jobType = jobType;
    this.jobId = jobId;
    this.startTime = Date.now();
    this.stepStartTime = Date.now();

    // Initialize Supabase client
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SERVICE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      // Auto-flush every 5 seconds to ensure logs are saved even if process crashes
      this.flushInterval = setInterval(() => this.flush(), 5000);
    } else {
      console.warn('[PipelineLogger] Supabase not configured, logs will only go to console');
    }
  }

  /**
   * Set the job ID (useful when job is created after logger initialization)
   */
  setJobId(jobId: string) {
    this.jobId = jobId;
  }

  /**
   * Mark the start of a new step (for duration tracking)
   */
  startStep() {
    this.stepStartTime = Date.now();
  }

  /**
   * Log a debug message (verbose, for detailed tracing)
   */
  debug(message: string, step?: string, details?: Record<string, unknown>) {
    this.log('debug', message, step, details);
  }

  /**
   * Log an info message (normal operations)
   */
  info(message: string, step?: string, details?: Record<string, unknown>) {
    this.log('info', message, step, details);
  }

  /**
   * Log a warning (non-fatal issues)
   */
  warn(message: string, step?: string, details?: Record<string, unknown>) {
    this.log('warn', message, step, details);
  }

  /**
   * Log an error (failures that need attention)
   */
  error(message: string, step?: string, details?: Record<string, unknown>) {
    this.log('error', message, step, details);
  }

  /**
   * Log with automatic error extraction
   */
  logError(error: unknown, step?: string, additionalDetails?: Record<string, unknown>) {
    const errorDetails: Record<string, unknown> = {
      ...additionalDetails,
    };

    if (error instanceof Error) {
      errorDetails['error_name'] = error.name;
      errorDetails['error_message'] = error.message;
      errorDetails['error_stack'] = error.stack?.split('\n').slice(0, 5).join('\n');
    } else {
      errorDetails['error_raw'] = String(error);
    }

    this.error(
      error instanceof Error ? error.message : String(error),
      step,
      errorDetails
    );
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, step?: string, details?: Record<string, unknown>) {
    const duration_ms = Date.now() - this.stepStartTime;

    const entry: LogEntry = {
      job_id: this.jobId,
      job_type: this.jobType,
      level,
      message,
      step,
      details,
      duration_ms,
    };

    // Always log to console for immediate visibility
    const prefix = `[${this.jobType}${this.jobId ? `:${this.jobId.slice(0, 8)}` : ''}]`;
    const stepStr = step ? `[${step}]` : '';
    const durationStr = duration_ms > 100 ? ` (${duration_ms}ms)` : '';

    const consoleMsg = `${prefix}${stepStr} ${message}${durationStr}`;

    switch (level) {
      case 'debug':
        console.debug(consoleMsg, details || '');
        break;
      case 'info':
        console.log(consoleMsg, details ? JSON.stringify(details) : '');
        break;
      case 'warn':
        console.warn(consoleMsg, details || '');
        break;
      case 'error':
        console.error(consoleMsg, details || '');
        break;
    }

    // Buffer for database write
    this.buffer.push(entry);

    // Immediately flush errors (don't wait for interval)
    if (level === 'error') {
      this.flush();
    }
  }

  /**
   * Flush buffered logs to database
   */
  async flush(): Promise<void> {
    if (!this.supabase || this.buffer.length === 0) return;

    const toFlush = [...this.buffer];
    this.buffer = [];

    try {
      const { error } = await this.supabase
        .from('pipeline_logs')
        .insert(toFlush);

      if (error) {
        console.error('[PipelineLogger] Failed to flush logs:', error.message);
        // Put entries back in buffer to retry
        this.buffer = [...toFlush, ...this.buffer];
      }
    } catch (err) {
      console.error('[PipelineLogger] Exception flushing logs:', err);
      this.buffer = [...toFlush, ...this.buffer];
    }
  }

  /**
   * Complete logging - flush remaining logs and cleanup
   */
  async complete(finalMessage?: string): Promise<void> {
    if (finalMessage) {
      this.info(finalMessage, 'complete', {
        total_duration_ms: Date.now() - this.startTime,
      });
    }

    // Stop auto-flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Get total elapsed time since logger creation
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Quick logging function for one-off logs (doesn't need full logger instance)
 */
export async function logPipelineEvent(
  jobType: string,
  level: LogLevel,
  message: string,
  step?: string,
  details?: Record<string, unknown>,
  jobId?: string
): Promise<void> {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    console.log(`[${jobType}] ${message}`, details || '');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    await supabase.from('pipeline_logs').insert({
      job_id: jobId,
      job_type: jobType,
      level,
      message,
      step,
      details,
    });
  } catch (err) {
    console.error('[logPipelineEvent] Failed to log:', err);
  }
}
