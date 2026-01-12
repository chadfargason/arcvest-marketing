/**
 * ArcVest Marketing Automation System
 * Logger Utility
 *
 * Structured logging with levels and context support.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  agent?: string;
  service?: string;
  action?: string;
  contactId?: string;
  taskId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  data?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel = 'info';
  private context: LogContext = {};

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Set default context for all log entries
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.minLevel = this.minLevel;
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Check if a level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(level: LogLevel, message: string, data?: unknown, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      data,
    };

    // Format context string
    const contextStr = Object.entries(entry.context ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');

    // Format output
    const prefix = contextStr ? `[${contextStr}]` : '';
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';

    const output = `${entry.timestamp} ${level.toUpperCase().padEnd(5)} ${prefix} ${message}${dataStr}`;

    // Output based on level
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  debug(message: string, data?: unknown, context?: LogContext): void {
    this.log('debug', message, data, context);
  }

  info(message: string, data?: unknown, context?: LogContext): void {
    this.log('info', message, data, context);
  }

  warn(message: string, data?: unknown, context?: LogContext): void {
    this.log('warn', message, data, context);
  }

  error(message: string, data?: unknown, context?: LogContext): void {
    this.log('error', message, data, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Set log level from environment
if (process.env['NODE_ENV'] === 'development') {
  logger.setLevel('debug');
} else {
  logger.setLevel('info');
}

/**
 * Create a named logger with default context
 */
export function createLogger(name: string): Logger {
  return logger.child({ service: name });
}

// Export class for creating child loggers
export { Logger };
