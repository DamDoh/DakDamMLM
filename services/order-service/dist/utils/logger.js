"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPerformanceMetric = exports.logSecurityEvent = exports.logCommissionTrigger = exports.logPaymentProcessing = exports.logInventoryUpdate = exports.logOrderStatusChange = exports.logOrderCreation = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...meta,
        service: 'order-service',
    });
}));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'order-service' },
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
const logOrderCreation = (userId, orderId, amount) => {
    logger.info('Order created', {
        userId,
        orderId,
        amount,
        type: 'order_creation'
    });
};
exports.logOrderCreation = logOrderCreation;
const logOrderStatusChange = (orderId, oldStatus, newStatus) => {
    logger.info('Order status changed', {
        orderId,
        oldStatus,
        newStatus,
        type: 'order_status_change'
    });
};
exports.logOrderStatusChange = logOrderStatusChange;
const logInventoryUpdate = (productId, change, reason) => {
    logger.info('Inventory updated', {
        productId,
        change,
        reason,
        type: 'inventory_update'
    });
};
exports.logInventoryUpdate = logInventoryUpdate;
const logPaymentProcessing = (orderId, amount, status) => {
    logger.info('Payment processed', {
        orderId,
        amount,
        status,
        type: 'payment_processing'
    });
};
exports.logPaymentProcessing = logPaymentProcessing;
const logCommissionTrigger = (orderId, userId, commissionAmount) => {
    logger.info('Commission calculation triggered', {
        orderId,
        userId,
        commissionAmount,
        type: 'commission_trigger'
    });
};
exports.logCommissionTrigger = logCommissionTrigger;
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