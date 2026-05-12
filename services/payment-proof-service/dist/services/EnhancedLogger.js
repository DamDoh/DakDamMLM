"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationMiddleware = exports.createCorrelationId = exports.logWithContext = exports.enhancedLogger = exports.EnhancedLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const crypto_1 = __importDefault(require("crypto"));
class EnhancedLogger {
    constructor() {
        this.logger = this.createLogger();
    }
    createLogger() {
        const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
            return JSON.stringify({
                timestamp,
                level: level.toUpperCase(),
                message,
                service: 'payment-proof-service',
                version: '1.0.0',
                ...meta
            });
        }));
        const transports = [
            // Error logs - separate file for errors
            new winston_daily_rotate_file_1.default({
                filename: 'logs/errors-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                level: 'error',
                maxSize: '20m',
                maxFiles: '30d',
                format: logFormat,
                zippedArchive: true
            }),
            // Security events - separate file for security monitoring
            new winston_daily_rotate_file_1.default({
                filename: 'logs/security-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                level: 'warn',
                maxSize: '20m',
                maxFiles: '90d',
                format: logFormat,
                zippedArchive: true
            }),
            // Application logs - main log file
            new winston_daily_rotate_file_1.default({
                filename: 'logs/payment-proof-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxSize: '50m',
                maxFiles: '14d',
                format: logFormat,
                zippedArchive: true
            }),
            // Performance logs - for monitoring response times
            new winston_daily_rotate_file_1.default({
                filename: 'logs/performance-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                level: 'info',
                maxSize: '20m',
                maxFiles: '7d',
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
                zippedArchive: true
            })
        ];
        // Console logging for development
        if (process.env.NODE_ENV !== 'production') {
            transports.push(new winston_1.default.transports.Console({
                level: process.env.LOG_LEVEL || 'debug',
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                    const correlationId = meta.correlationId ? `[${meta.correlationId}] ` : '';
                    const userId = meta.userId ? `[User:${meta.userId}] ` : '';
                    return `${timestamp} ${level} ${correlationId}${userId}${message}`;
                }))
            }));
        }
        return winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            transports,
            exceptionHandlers: [
                new winston_daily_rotate_file_1.default({
                    filename: 'logs/exceptions-%DATE%.log',
                    datePattern: 'YYYY-MM-DD'
                })
            ],
            rejectionHandlers: [
                new winston_daily_rotate_file_1.default({
                    filename: 'logs/rejections-%DATE%.log',
                    datePattern: 'YYYY-MM-DD'
                })
            ],
            exitOnError: false
        });
    }
    // Core logging methods with context
    info(message, context = {}) {
        this.logger.info(message, this.enrichContext(context));
    }
    warn(message, context = {}) {
        this.logger.warn(message, this.enrichContext(context));
    }
    error(message, context = {}) {
        this.logger.error(message, this.enrichContext(context));
    }
    debug(message, context = {}) {
        this.logger.debug(message, this.enrichContext(context));
    }
    // Specialized logging methods
    logAPIRequest(method, url, statusCode, duration, context = {}) {
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
    logSecurityEvent(event, severity, context = {}) {
        const level = severity === 'critical' ? 'error' : 'warn';
        this.logger.log(level, `Security Event: ${event}`, {
            ...this.enrichContext(context),
            event,
            severity,
            type: 'security_event'
        });
    }
    logPerformance(operation, duration, context = {}) {
        this.logger.info(`Performance: ${operation}`, {
            ...this.enrichContext(context),
            operation,
            duration,
            durationUnit: 'ms',
            type: 'performance'
        });
    }
    logBusinessEvent(event, context = {}) {
        this.logger.info(`Business Event: ${event}`, {
            ...this.enrichContext(context),
            event,
            type: 'business_event'
        });
    }
    logDatabaseQuery(query, duration, context = {}) {
        this.logger.debug(`Database Query: ${query}`, {
            ...this.enrichContext(context),
            query: query.substring(0, 500), // Truncate long queries
            duration,
            durationUnit: 'ms',
            type: 'database_query'
        });
    }
    logCacheOperation(operation, key, context = {}) {
        this.logger.debug(`Cache ${operation}: ${key}`, {
            ...this.enrichContext(context),
            operation,
            cacheKey: key,
            type: 'cache_operation'
        });
    }
    logCircuitBreakerEvent(serviceName, event, context = {}) {
        this.logger.warn(`Circuit Breaker ${event}: ${serviceName}`, {
            ...this.enrichContext(context),
            serviceName,
            event,
            type: 'circuit_breaker'
        });
    }
    // Context enrichment
    enrichContext(context) {
        return {
            correlationId: context.correlationId || this.generateCorrelationId(),
            timestamp: new Date().toISOString(),
            hostname: process.env.HOSTNAME || 'unknown',
            environment: process.env.NODE_ENV || 'development',
            ...context
        };
    }
    // Generate correlation ID for request tracing
    generateCorrelationId() {
        return crypto_1.default.randomUUID();
    }
    // Create child logger with persistent context
    child(context) {
        const childLogger = new EnhancedLogger();
        // In a more sophisticated implementation, we'd maintain context across calls
        // For now, we'll just return a new instance
        return childLogger;
    }
    // Health check
    async healthCheck() {
        try {
            // Test logging
            this.logger.info('Logger health check');
            return true;
        }
        catch {
            return false;
        }
    }
    // Flush all pending logs
    async flush() {
        return new Promise((resolve) => {
            this.logger.on('finish', resolve);
            this.logger.end();
        });
    }
    // Get logger statistics
    getStats() {
        // Winston doesn't expose detailed stats, but we can return basic info
        return {
            level: this.logger.level,
            transports: this.logger.transports.length
        };
    }
    // Log method for compatibility
    log(level, message, context = {}) {
        this.logger.log(level, message, this.enrichContext(context));
    }
}
exports.EnhancedLogger = EnhancedLogger;
// Global logger instance
exports.enhancedLogger = new EnhancedLogger();
// Helper functions for easy access
const logWithContext = (level, message, context = {}) => {
    exports.enhancedLogger.log(level, message, context);
};
exports.logWithContext = logWithContext;
const createCorrelationId = () => {
    return exports.enhancedLogger.generateCorrelationId();
};
exports.createCorrelationId = createCorrelationId;
// Middleware for adding correlation ID to requests
const correlationMiddleware = (req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || (0, exports.createCorrelationId)();
    res.setHeader('x-correlation-id', req.correlationId);
    next();
};
exports.correlationMiddleware = correlationMiddleware;
//# sourceMappingURL=EnhancedLogger.js.map