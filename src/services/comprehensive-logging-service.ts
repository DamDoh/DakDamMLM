// Comprehensive Logging Service
// ELK Stack integration with structured logging

import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { format } from 'winston';
import { distributedTracingService } from './distributed-tracing-service';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LogContext {
  userId?: string;
  companyId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  [key: string]: any;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

class ComprehensiveLoggingService {
  private static instance: ComprehensiveLoggingService;
  private logger: winston.Logger;

  private constructor() {
    this.initializeLogger();
  }

  static getInstance(): ComprehensiveLoggingService {
    if (!ComprehensiveLoggingService.instance) {
      ComprehensiveLoggingService.instance = new ComprehensiveLoggingService();
    }
    return ComprehensiveLoggingService.instance;
  }

  // Initialize Winston logger with multiple transports
  private initializeLogger(): void {
    const transports: winston.transport[] = [];

    // Console transport for development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          level: 'debug',
          format: format.combine(
            format.colorize(),
            format.timestamp(),
            format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
          ),
        })
      );
    }

    // File transport with daily rotation
    transports.push(
      new DailyRotateFile({
        filename: 'logs/mlm-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json()
        ),
      })
    );

    // Error log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/mlm-error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json()
        ),
      })
    );

    // Elasticsearch transport (if configured)
    if (process.env.ELASTICSEARCH_NODE) {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          indexPrefix: 'mlm-logs',
          clientOpts: {
            node: process.env.ELASTICSEARCH_NODE,
            auth: process.env.ELASTICSEARCH_AUTH ? {
              username: process.env.ELASTICSEARCH_AUTH.split(':')[0],
              password: process.env.ELASTICSEARCH_AUTH.split(':')[1],
            } : undefined,
          },
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.json()
          ),
        })
      );
    }

    // Create logger instance
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
        format.metadata()
      ),
      defaultMeta: {
        service: 'mlm-platform',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      transports,
    });

    console.log('Comprehensive logging service initialized');
  }

  // Log with context and tracing
  private logWithContext(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const logData: any = {
      message,
      timestamp: new Date().toISOString(),
      level,
    };

    // Add trace context
    const traceContext = distributedTracingService.getCurrentTraceContext();
    if (traceContext) {
      logData.traceId = traceContext.traceId;
      logData.spanId = traceContext.spanId;
      logData.serviceName = traceContext.serviceName;
      logData.operationName = traceContext.operationName;
    }

    // Add custom context
    if (context) {
      Object.assign(logData, context);
    }

    // Add error details
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Log based on level
    switch (level) {
      case LogLevel.ERROR:
        this.logger.error(message, logData);
        break;
      case LogLevel.WARN:
        this.logger.warn(message, logData);
        break;
      case LogLevel.INFO:
        this.logger.info(message, logData);
        break;
      case LogLevel.DEBUG:
        this.logger.debug(message, logData);
        break;
    }
  }

  // Error logging
  error(message: string, context?: LogContext, error?: Error): void {
    this.logWithContext(LogLevel.ERROR, message, context, error);
  }

  // Warning logging
  warn(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.WARN, message, context);
  }

  // Info logging
  info(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.INFO, message, context);
  }

  // Debug logging
  debug(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.DEBUG, message, context);
  }

  // Security event logging
  securityEvent(
    event: string,
    details: Record<string, any>,
    context?: LogContext
  ): void {
    this.logWithContext(LogLevel.WARN, `Security Event: ${event}`, {
      ...context,
      securityEvent: true,
      eventType: event,
      ...details,
    });
  }

  // Audit logging
  auditEvent(
    action: string,
    entity: string,
    entityId: string,
    changes?: Record<string, any>,
    context?: LogContext
  ): void {
    this.logWithContext(LogLevel.INFO, `Audit: ${action}`, {
      ...context,
      auditEvent: true,
      action,
      entity,
      entityId,
      changes,
    });
  }

  // Performance logging
  performanceLog(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
    context?: LogContext
  ): void {
    this.logWithContext(LogLevel.INFO, `Performance: ${operation}`, {
      ...context,
      performanceEvent: true,
      operation,
      duration,
      durationUnit: 'ms',
      ...metadata,
    });
  }

  // API request logging
  apiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

    this.logWithContext(level, `API Request: ${method} ${path}`, {
      ...context,
      apiEvent: true,
      method,
      path,
      statusCode,
      duration,
      durationUnit: 'ms',
    });
  }

  // Database operation logging
  databaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    context?: LogContext
  ): void {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;

    this.logWithContext(level, `Database: ${operation}`, {
      ...context,
      databaseEvent: true,
      operation,
      table,
      duration,
      durationUnit: 'ms',
      success,
    });
  }

  // Business event logging
  businessEvent(
    event: string,
    entityType: string,
    entityId: string,
    details?: Record<string, any>,
    context?: LogContext
  ): void {
    this.logWithContext(LogLevel.INFO, `Business Event: ${event}`, {
      ...context,
      businessEvent: true,
      event,
      entityType,
      entityId,
      ...details,
    });
  }

  // Create child logger with fixed context
  child(context: LogContext): Pick<ComprehensiveLoggingService,
    'error' | 'warn' | 'info' | 'debug' |
    'securityEvent' | 'auditEvent' | 'performanceLog' |
    'apiRequest' | 'databaseOperation' | 'businessEvent'
  > {
    return {
      error: (message: string, ctx?: LogContext, error?: Error) =>
        this.error(message, { ...context, ...ctx }, error),
      warn: (message: string, ctx?: LogContext) =>
        this.warn(message, { ...context, ...ctx }),
      info: (message: string, ctx?: LogContext) =>
        this.info(message, { ...context, ...ctx }),
      debug: (message: string, ctx?: LogContext) =>
        this.debug(message, { ...context, ...ctx }),
      securityEvent: (event: string, details: Record<string, any>, ctx?: LogContext) =>
        this.securityEvent(event, details, { ...context, ...ctx }),
      auditEvent: (action: string, entity: string, entityId: string, changes?: Record<string, any>, ctx?: LogContext) =>
        this.auditEvent(action, entity, entityId, changes, { ...context, ...ctx }),
      performanceLog: (operation: string, duration: number, metadata?: Record<string, any>, ctx?: LogContext) =>
        this.performanceLog(operation, duration, metadata, { ...context, ...ctx }),
      apiRequest: (method: string, path: string, statusCode: number, duration: number, ctx?: LogContext) =>
        this.apiRequest(method, path, statusCode, duration, { ...context, ...ctx }),
      databaseOperation: (operation: string, table: string, duration: number, success: boolean, ctx?: LogContext) =>
        this.databaseOperation(operation, table, duration, success, { ...context, ...ctx }),
      businessEvent: (event: string, entityType: string, entityId: string, details?: Record<string, any>, ctx?: LogContext) =>
        this.businessEvent(event, entityType, entityId, details, { ...context, ...ctx }),
    };
  }

  // Query logs (for debugging - requires Elasticsearch)
  async queryLogs(
    query: {
      level?: LogLevel;
      startTime?: Date;
      endTime?: Date;
      userId?: string;
      traceId?: string;
      limit?: number;
    }
  ): Promise<any[]> {
    // This would integrate with Elasticsearch for log querying
    // For now, return empty array
    console.warn('Log querying not implemented - requires Elasticsearch integration');
    return [];
  }

  // Get log statistics
  getLogStats(): {
    levels: Record<LogLevel, number>;
    recentErrors: number;
    totalLogs: number;
  } {
    // This would track log statistics
    // For now, return mock data
    return {
      levels: {
        [LogLevel.ERROR]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.DEBUG]: 0,
      },
      recentErrors: 0,
      totalLogs: 0,
    };
  }

  // Flush logs (for graceful shutdown)
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

export const comprehensiveLoggingService = ComprehensiveLoggingService.getInstance();
export default comprehensiveLoggingService;