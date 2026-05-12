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
      service: 'order-service',
    });
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'order-service' },
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
export const logOrderCreation = (userId: string, orderId: string, amount: number) => {
  logger.info('Order created', {
    userId,
    orderId,
    amount,
    type: 'order_creation'
  });
};

export const logOrderStatusChange = (orderId: string, oldStatus: string, newStatus: string) => {
  logger.info('Order status changed', {
    orderId,
    oldStatus,
    newStatus,
    type: 'order_status_change'
  });
};

export const logInventoryUpdate = (productId: string, change: number, reason: string) => {
  logger.info('Inventory updated', {
    productId,
    change,
    reason,
    type: 'inventory_update'
  });
};

export const logPaymentProcessing = (orderId: string, amount: number, status: string) => {
  logger.info('Payment processed', {
    orderId,
    amount,
    status,
    type: 'payment_processing'
  });
};

export const logCommissionTrigger = (orderId: string, userId: string, commissionAmount: number) => {
  logger.info('Commission calculation triggered', {
    orderId,
    userId,
    commissionAmount,
    type: 'commission_trigger'
  });
};

export const logSecurityEvent = (userId: string, action: string, ip?: string) => {
  logger.warn('Security event detected', {
    userId,
    action,
    ip,
    type: 'security_event'
  });
};

export const logPerformanceMetric = (operation: string, duration: number, metadata?: any) => {
  logger.info('Performance metric', {
    operation,
    duration,
    ...metadata,
    type: 'performance_metric'
  });
};