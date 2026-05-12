import winston from 'winston';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
      service: 'notification-service',
    });
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'notification-service' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production then log to the `console` with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    )
  }));
}

export { logger };

// Helper functions for different log levels
export const logNotificationSent = (userId: string, notificationType: string, channel: string, status: string) => {
  logger.info('Notification sent', {
    userId,
    notificationType,
    channel,
    status,
    type: 'notification_sent'
  });
};

export const logNotificationFailed = (userId: string, notificationType: string, channel: string, reason: string) => {
  logger.warn('Notification failed', {
    userId,
    notificationType,
    channel,
    reason,
    type: 'notification_failed'
  });
};

export const logTemplateRendered = (templateId: string, userId: string) => {
  logger.debug('Template rendered', {
    templateId,
    userId,
    type: 'template_rendered'
  });
};

export const logCampaignExecuted = (campaignId: string, recipients: number) => {
  logger.info('Campaign executed', {
    campaignId,
    recipients,
    type: 'campaign_executed'
  });
};

export const logProviderError = (provider: string, error: string) => {
  logger.error('Provider error', {
    provider,
    error,
    type: 'provider_error'
  });
};

export const logWebhookReceived = (provider: string, event: string) => {
  logger.info('Webhook received', {
    provider,
    event,
    type: 'webhook_received'
  });
};