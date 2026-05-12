import { NextRequest } from 'next/server';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
}

// Logger class
export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogsInMemory = 1000;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Core logging methods
  error(message: string, context?: Record<string, any>, request?: NextRequest): void {
    this.log(LogLevel.ERROR, message, context, request);
  }

  warn(message: string, context?: Record<string, any>, request?: NextRequest): void {
    this.log(LogLevel.WARN, message, context, request);
  }

  info(message: string, context?: Record<string, any>, request?: NextRequest): void {
    this.log(LogLevel.INFO, message, context, request);
  }

  debug(message: string, context?: Record<string, any>, request?: NextRequest): void {
    // Only log debug in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, context, request);
    }
  }

  // Performance logging
  performance(operation: string, duration: number, context?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      duration,
      performance: true
    });
  }

  // Security logging
  security(event: string, userId?: string, context?: Record<string, any>, request?: NextRequest): void {
    this.warn(`Security: ${event}`, {
      ...context,
      userId,
      security: true
    }, request);
  }

  // Audit logging
  audit(action: string, userId: string, resource: string, context?: Record<string, any>): void {
    this.info(`Audit: ${action} on ${resource}`, {
      ...context,
      userId,
      resource,
      audit: true
    });
  }

  // API request logging
  apiRequest(method: string, url: string, statusCode: number, duration: number, request?: NextRequest): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : statusCode >= 300 ? LogLevel.WARN : LogLevel.INFO;

    this.log(level, `API ${method} ${url}`, {
      method,
      url,
      statusCode,
      duration,
      api: true
    }, request);
  }

  // Database operation logging
  database(operation: string, table: string, duration: number, context?: Record<string, any>): void {
    this.info(`Database: ${operation} on ${table}`, {
      ...context,
      operation,
      table,
      duration,
      database: true
    });
  }

  // Commission calculation logging
  commission(memberId: string, type: string, amount: number, context?: Record<string, any>): void {
    this.info(`Commission: ${type} for member ${memberId}`, {
      ...context,
      memberId,
      type,
      amount,
      commission: true
    });
  }

  // Private logging method
  private log(level: LogLevel, message: string, context?: Record<string, any>, request?: NextRequest): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      requestId: this.extractRequestId(request),
      ip: this.extractIP(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      url: request?.url,
      method: request?.method
    };

    // Add to in-memory logs
    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // In production, this would send to external logging service
    // For now, we'll use console in development only
    if (process.env.NODE_ENV === 'development') {
      const logMethod = level === LogLevel.ERROR ? console.error :
                        level === LogLevel.WARN ? console.warn : console.log;

      logMethod(`[${level.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }

    // TODO: In production, send to logging service (DataDog, CloudWatch, etc.)
    // this.sendToExternalService(entry);
  }

  // Extract request ID from headers
  private extractRequestId(request?: NextRequest): string | undefined {
    return request?.headers.get('x-request-id') || undefined;
  }

  // Extract IP address
  private extractIP(request?: NextRequest): string | undefined {
    return request?.headers.get('x-forwarded-for') ||
           request?.headers.get('x-real-ip') ||
           'unknown';
  }

  // Get recent logs
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
    return this.logs.filter(log => log.level === level).slice(-limit);
  }

  // Get logs by user
  getLogsByUser(userId: string, limit: number = 100): LogEntry[] {
    return this.logs.filter(log => log.userId === userId).slice(-limit);
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs to JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Convenience functions for direct use
export const logError = (message: string, context?: Record<string, any>, request?: NextRequest) =>
  logger.error(message, context, request);

export const logWarn = (message: string, context?: Record<string, any>, request?: NextRequest) =>
  logger.warn(message, context, request);

export const logInfo = (message: string, context?: Record<string, any>, request?: NextRequest) =>
  logger.info(message, context, request);

export const logDebug = (message: string, context?: Record<string, any>, request?: NextRequest) =>
  logger.debug(message, context, request);

export const logPerformance = (operation: string, duration: number, context?: Record<string, any>) =>
  logger.performance(operation, duration, context);

export const logSecurity = (event: string, userId?: string, context?: Record<string, any>, request?: NextRequest) =>
  logger.security(event, userId, context, request);

export const logAudit = (action: string, userId: string, resource: string, context?: Record<string, any>) =>
  logger.audit(action, userId, resource, context);

export const logApiRequest = (method: string, url: string, statusCode: number, duration: number, request?: NextRequest) =>
  logger.apiRequest(method, url, statusCode, duration, request);

export const logDatabase = (operation: string, table: string, duration: number, context?: Record<string, any>) =>
  logger.database(operation, table, duration, context);

export const logCommission = (memberId: string, type: string, amount: number, context?: Record<string, any>) =>
  logger.commission(memberId, type, amount, context);