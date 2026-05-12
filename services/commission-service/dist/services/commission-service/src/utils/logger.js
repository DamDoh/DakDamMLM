"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPayoutError = exports.logCommissionError = exports.logBonusAchieved = exports.logPayoutProcessed = exports.logCommissionPaid = exports.logCommissionCalculated = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...meta,
        service: 'commission-service',
    });
}));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'commission-service' },
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
const logCommissionCalculated = (userId, orderId, amount, type) => {
    logger.info('Commission calculated', {
        userId,
        orderId,
        amount,
        commissionType: type,
        type: 'commission_calculated'
    });
};
exports.logCommissionCalculated = logCommissionCalculated;
const logCommissionPaid = (userId, commissionId, amount, method) => {
    logger.info('Commission paid', {
        userId,
        commissionId,
        amount,
        method,
        type: 'commission_paid'
    });
};
exports.logCommissionPaid = logCommissionPaid;
const logPayoutProcessed = (userId, payoutId, amount, status) => {
    logger.info('Payout processed', {
        userId,
        payoutId,
        amount,
        status,
        type: 'payout_processed'
    });
};
exports.logPayoutProcessed = logPayoutProcessed;
const logBonusAchieved = (userId, bonusType, amount, period) => {
    logger.info('Bonus achieved', {
        userId,
        bonusType,
        amount,
        period,
        type: 'bonus_achieved'
    });
};
exports.logBonusAchieved = logBonusAchieved;
const logCommissionError = (userId, orderId, error) => {
    logger.error('Commission calculation error', {
        userId,
        orderId,
        error,
        type: 'commission_error'
    });
};
exports.logCommissionError = logCommissionError;
const logPayoutError = (userId, payoutId, error) => {
    logger.error('Payout processing error', {
        userId,
        payoutId,
        error,
        type: 'payout_error'
    });
};
exports.logPayoutError = logPayoutError;
//# sourceMappingURL=logger.js.map