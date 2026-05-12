"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPerformanceMetric = exports.logSecurityEvent = exports.logPaymentFailure = exports.logCommissionPayout = exports.logPayoutRequest = exports.logWalletTransaction = exports.logPaymentProcessing = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...meta,
        service: 'payment-service',
    });
}));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'payment-service' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});
exports.logger = logger;
// If we're not in production then log to the `console` with a simple format
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level}: ${message}${metaStr}`;
        }))
    }));
}
// Helper functions for different log levels
const logPaymentProcessing = (userId, amount, method, status) => {
    logger.info('Payment processed', {
        userId,
        amount,
        method,
        status,
        type: 'payment_processing'
    });
};
exports.logPaymentProcessing = logPaymentProcessing;
const logWalletTransaction = (userId, type, amount, balance) => {
    logger.info('Wallet transaction', {
        userId,
        transactionType: type,
        amount,
        balance,
        type: 'wallet_transaction'
    });
};
exports.logWalletTransaction = logWalletTransaction;
const logPayoutRequest = (userId, amount, method) => {
    logger.info('Payout requested', {
        userId,
        amount,
        method,
        type: 'payout_request'
    });
};
exports.logPayoutRequest = logPayoutRequest;
const logCommissionPayout = (userId, commissionId, amount) => {
    logger.info('Commission payout processed', {
        userId,
        commissionId,
        amount,
        type: 'commission_payout'
    });
};
exports.logCommissionPayout = logCommissionPayout;
const logPaymentFailure = (userId, amount, reason) => {
    logger.warn('Payment failed', {
        userId,
        amount,
        reason,
        type: 'payment_failure'
    });
};
exports.logPaymentFailure = logPaymentFailure;
const logSecurityEvent = (userId, action, ip) => {
    logger.warn('Security event detected', {
        userId,
        action,
        ip,
        type: 'security_event'
    });
};
exports.logSecurityEvent = logSecurityEvent;
const logPerformanceMetric = (operation, duration, metadata) => {
    logger.info('Performance metric', {
        operation,
        duration,
        ...metadata,
        type: 'performance_metric'
    });
};
exports.logPerformanceMetric = logPerformanceMetric;
//# sourceMappingURL=logger.js.map