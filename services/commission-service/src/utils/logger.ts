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
      service: 'commission-service',
    });
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'commission-service' },
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
export const logCommissionCalculated = (userId: string, orderId: string, amount: number, type: string) => {
  logger.info('Commission calculated', {
    userId,
    orderId,
    amount,
    commissionType: type,
    type: 'commission_calculated'
  });
};

export const logCommissionPaid = (userId: string, commissionId: string, amount: number, method: string) => {
  logger.info('Commission paid', {
    userId,
    commissionId,
    amount,
    method,
    type: 'commission_paid'
  });
};

export const logPayoutProcessed = (userId: string, payoutId: string, amount: number, status: string) => {
  logger.info('Payout processed', {
    userId,
    payoutId,
    amount,
    status,
    type: 'payout_processed'
  });
};

export const logBonusAchieved = (userId: string, bonusType: string, amount: number, period: string) => {
  logger.info('Bonus achieved', {
    userId,
    bonusType,
    amount,
    period,
    type: 'bonus_achieved'
  });
};

export const logCommissionError = (userId: string, orderId: string, error: string) => {
  logger.error('Commission calculation error', {
    userId,
    orderId,
    error,
    type: 'commission_error'
  });
};

export const logPayoutError = (userId: string, payoutId: string, error: string) => {
  logger.error('Payout processing error', {
    userId,
    payoutId,
    error,
    type: 'payout_error'
  });
};