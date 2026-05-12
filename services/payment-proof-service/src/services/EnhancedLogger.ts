import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import crypto from 'crypto';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  proofId?: string;
  orderId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

export class EnhancedLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level: level.toUpperCase(),
          message,
          service: 'payment-proof-service',
          version: '1.0.0',
          ...meta
        });
      })
    );

    const transports: winston.transport[] = [
      // Error logs - separate file for errors
      new DailyRotateFile({
        filename: 'logs/errors-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat,
        zippedArchive: true
      }),

      // Security events - separate file for security monitoring
      new DailyRotateFile({
        filename: 'logs/security-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'warn',
        maxSize: '20m',
        maxFiles: '90d',
        format: logFormat,
        zippedArchive: true
      }),

      // Application logs - main log file
      new DailyRotateFile({
        filename: 'logs/payment-proof-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '14d',
        format: logFormat,
        zippedArchive: true
      }),

      // Performance logs - for monitoring response times
      new DailyRotateFile({
        filename: 'logs/performance-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxSize: '20m',
        maxFiles: '7d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        zippedArchive: true
      })
    ];

    // Console logging for development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          level: process.env.LOG_LEVEL || 'debug',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const correlationId = meta.correlationId ? `[${meta.correlationId}] ` : '';
              const userId = meta.userId ? `[User:${meta.userId}] ` : '';
              return `${timestamp} ${level} ${correlationId}${userId}${message}`;
            })
          )
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports,
      exceptionHandlers: [
        new DailyRotateFile({
          filename: 'logs/exceptions-%DATE%.log',
          datePattern: 'YYYY-MM-DD'
        })
      ],
      rejectionHandlers: [
        new DailyRotateFile({
          filename: 'logs/rejections-%DATE%.log',
          datePattern: 'YYYY-MM-DD'
        })
      ],
      exitOnError: false
    });
  }

  // Core logging methods with context
  info(message: string, context: LogContext = {}): void {
    this.logger.info(message, this.enrichContext(context));
  }

  warn(message: string, context: LogContext = {}): void {
    this.logger.warn(message, this.enrichContext(context));
  }

  error(message: string, context: LogContext = {}): void {
    this.logger.error(message, this.enrichContext(context));
  }

  debug(message: string, context: LogContext = {}): void {
    this.logger.debug(message, this.enrichContext(context));
  }

  // Specialized logging methods
  logAPIRequest(method: string, url: string, statusCode: number, duration: number, context: LogContext = {}): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.logger.log(level, `API ${method} ${url}`, {
      ...this.enrichContext(context),
      method,
      url,
      statusCode,
      duration,
      durationUnit: 'ms',
      type: 'api_request'
    });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context: LogContext = {}): void {
    const level = severity === 'critical' ? 'error' : 'warn';

    this.logger.log(level, `Security Event: ${event}`, {
      ...this.enrichContext(context),
      event,
      severity,
      type: 'security_event'
    });
  }

  logPerformance(operation: string, duration: number, context: LogContext = {}): void {
    this.logger.info(`Performance: ${operation}`, {
      ...this.enrichContext(context),
      operation,
      duration,
      durationUnit: 'ms',
      type: 'performance'
    });
  }

  logBusinessEvent(event: string, context: LogContext = {}): void {
    this.logger.info(`Business Event: ${event}`, {
      ...this.enrichContext(context),
      event,
      type: 'business_event'
    });
  }

  logDatabaseQuery(query: string, duration: number, context: LogContext = {}): void {
    this.logger.debug(`Database Query: ${query}`, {
      ...this.enrichContext(context),
      query: query.substring(0, 500), // Truncate long queries
      duration,
      durationUnit: 'ms',
      type: 'database_query'
    });
  }

  logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, context: LogContext = {}): void {
    this.logger.debug(`Cache ${operation}: ${key}`, {
      ...this.enrichContext(context),
      operation,
      cacheKey: key,
      type: 'cache_operation'
    });
  }

  logCircuitBreakerEvent(serviceName: string, event: 'open' | 'close' | 'half_open', context: LogContext = {}): void {
    this.logger.warn(`Circuit Breaker ${event}: ${serviceName}`, {
      ...this.enrichContext(context),
      serviceName,
      event,
      type: 'circuit_breaker'
    });
  }

  // Context enrichment
  private enrichContext(context: LogContext): LogContext {
    return {
      correlationId: context.correlationId || this.generateCorrelationId(),
      timestamp: new Date().toISOString(),
      hostname: process.env.HOSTNAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...context
    };
  }

  // Generate correlation ID for request tracing
  generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  // Create child logger with persistent context
  child(context: LogContext): EnhancedLogger {
    const childLogger = new EnhancedLogger();
    // In a more sophisticated implementation, we'd maintain context across calls
    // For now, we'll just return a new instance
    return childLogger;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Test logging
      this.logger.info('Logger health check');
      return true;
    } catch {
      return false;
    }
  }

  // Flush all pending logs
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  // Get logger statistics
  getStats(): any {
    // Winston doesn't expose detailed stats, but we can return basic info
    return {
      level: this.logger.level,
      transports: this.logger.transports.length
    };
  }

  // Log method for compatibility
  log(level: string, message: string, context: LogContext = {}): void {
    this.logger.log(level as any, message, this.enrichContext(context));
  }
}

// Global logger instance
export const enhancedLogger = new EnhancedLogger();

// Helper functions for easy access
export const logWithContext = (level: string, message: string, context: LogContext = {}) => {
  enhancedLogger.log(level as any, message, context);
};

export const createCorrelationId = (): string => {
  return enhancedLogger.generateCorrelationId();
};

// Middleware for adding correlation ID to requests
export const correlationMiddleware = (req: any, res: any, next: any) => {
  req.correlationId = req.headers['x-correlation-id'] || createCorrelationId();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
};