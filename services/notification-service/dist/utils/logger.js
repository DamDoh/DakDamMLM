"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWebhookReceived = exports.logProviderError = exports.logCampaignExecuted = exports.logTemplateRendered = exports.logNotificationFailed = exports.logNotificationSent = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...meta,
        service: 'notification-service',
    });
}));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'notification-service' },
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
const logNotificationSent = (userId, notificationType, channel, status) => {
    logger.info('Notification sent', {
        userId,
        notificationType,
        channel,
        status,
        type: 'notification_sent'
    });
};
exports.logNotificationSent = logNotificationSent;
const logNotificationFailed = (userId, notificationType, channel, reason) => {
    logger.warn('Notification failed', {
        userId,
        notificationType,
        channel,
        reason,
        type: 'notification_failed'
    });
};
exports.logNotificationFailed = logNotificationFailed;
const logTemplateRendered = (templateId, userId) => {
    logger.debug('Template rendered', {
        templateId,
        userId,
        type: 'template_rendered'
    });
};
exports.logTemplateRendered = logTemplateRendered;
const logCampaignExecuted = (campaignId, recipients) => {
    logger.info('Campaign executed', {
        campaignId,
        recipients,
        type: 'campaign_executed'
    });
};
exports.logCampaignExecuted = logCampaignExecuted;
const logProviderError = (provider, error) => {
    logger.error('Provider error', {
        provider,
        error,
        type: 'provider_error'
    });
};
exports.logProviderError = logProviderError;
const logWebhookReceived = (provider, event) => {
    logger.info('Webhook received', {
        provider,
        event,
        type: 'webhook_received'
    });
};
exports.logWebhookReceived = logWebhookReceived;
//# sourceMappingURL=logger.js.map