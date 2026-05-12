import express, { Request, Response } from 'express';
type NextFunction = (err?: any) => void;
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import compression from 'compression';
import dotenv from 'dotenv';
import { notificationRoutes } from './routes/notificationRoutes';
import { templateRoutes } from './routes/templateRoutes';
import { preferenceRoutes } from './routes/preferenceRoutes';
import { campaignRoutes } from './routes/campaignRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { swaggerUi, swaggerSpec } from './utils/swagger';
import { logger, logNotificationSent } from './utils/logger';
import { metricsService } from './utils/metrics';
import { cacheService } from './utils/cache';
import { queueService } from './utils/queue';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression({
  level: 6, // Balanced compression
  threshold: 1024, // Only compress responses > 1KB
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Sanitize string inputs
  const sanitizeString = (str: string) => str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    (req as any).body = sanitizeObject((req as any).body);
  }

  next();
});

// Rate limiting - standard limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: (req as any).ip,
      path: (req as any).path,
      userAgent: (req as any).get('User-Agent'),
      type: 'rate_limit_exceeded'
    });
    (res as any).status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Speed limiter - gradual slowdown
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 100, // add 100ms of delay per request after delayAfter
});

// Apply rate limiting to API routes
app.use('/api/', limiter);
app.use('/api/', speedLimiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add request ID to response header
  (res as any).set('X-Request-ID', requestId);

  logger.info('Incoming request', {
    method: (req as any).method,
    path: (req as any).path,
    ip: (req as any).ip,
    userAgent: (req as any).get('User-Agent'),
    requestId,
    type: 'request_start'
  });

  // Track response
  (res as any).on('finish', () => {
    const duration = Date.now() - start;
    metricsService.observeRequest((req as any).method, (req as any).path, (res as any).statusCode, duration);

    logger.info('Request completed', {
      method: (req as any).method,
      path: (req as any).path,
      statusCode: (res as any).statusCode,
      duration,
      requestId,
      type: 'request_complete'
    });
  });

  next();
});

// Health check endpoint (no auth required)
app.use('/api/health', healthRoutes);

// Swagger documentation
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  logger.info('Swagger documentation available at /api-docs');
}

// API routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/campaigns', campaignRoutes);

// Metrics endpoint for Prometheus
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    (res as any).set('Content-Type', 'text/plain; charset=utf-8');
    (res as any).send(metrics);
  } catch (error) {
    logger.error('Failed to serve metrics', { error: (error as Error).message });
    (res as any).status(500).send('Error generating metrics');
  }
});

// Webhook endpoints for notification providers (no auth required)
app.post('/webhooks/sendgrid', express.raw({ type: 'application/json' }), (req: Request, res: Response) => {
  // Handle SendGrid webhooks
  logger.info('SendGrid webhook received', { type: 'webhook_sendgrid' });
  (res as any).json({ received: true });
});

app.post('/webhooks/twilio', (req: Request, res: Response) => {
  // Handle Twilio webhooks
  logger.info('Twilio webhook received', { type: 'webhook_twilio' });
  (res as any).json({ received: true });
});

app.post('/webhooks/firebase', (req: Request, res: Response) => {
  // Handle Firebase webhooks
  logger.info('Firebase webhook received', { type: 'webhook_firebase' });
  (res as any).json({ received: true });
});

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn('Route not found', {
    method: (req as any).method,
    path: (req as any).path,
    ip: (req as any).ip,
    type: 'route_not_found'
  });

  (res as any).status(404).json({
    success: false,
    error: 'Route not found',
    path: (req as any).path,
    method: (req as any).method,
  });
});

// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = ((res as any).getHeader('X-Request-ID') as string) || 'unknown';

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: (req as any).method,
    path: (req as any).path,
    ip: (req as any).ip,
    requestId,
    type: 'unhandled_error'
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const errorResponse: Record<string, any> = {
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (isDevelopment) {
    errorResponse.stack = err.stack;
  }

  (res as any).status(err.status || 500).json(errorResponse);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    // Close connections
    await queueService.close();
    await cacheService.disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: (error as Error).message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, async () => {
  logger.info('Notification service started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    type: 'service_start'
  });

  // Initialize connections
  try {
    await cacheService.connect();
    await queueService.connect();
    logger.info('All connections established successfully');
  } catch (error) {
    logger.error('Failed to establish connections', { error: (error as Error).message });
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
    type: 'uncaught_exception'
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason,
    promise: promise,
    type: 'unhandled_rejection'
  });
  process.exit(1);
});

export default app;