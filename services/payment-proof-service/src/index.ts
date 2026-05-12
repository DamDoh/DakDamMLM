import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import multer from 'multer';

// Import database and logging
import { prisma } from './config/database';
export { prisma } from './config/database';
import { enhancedLogger, correlationMiddleware } from './services/EnhancedLogger';
export const logger = enhancedLogger;

// Import routes
import { proofRoutes } from './routes/proofRoutes';
import { approvalRoutes } from './routes/approvalRoutes';
import { disputeRoutes } from './routes/disputeRoutes';
import { healthRoutes } from './routes/healthRoutes';

// Import middleware
import { authMiddleware } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorHandler';

// Import services
import { redisService } from './services/RedisService';
import { circuitBreakerService } from './services/CircuitBreakerService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(correlationMiddleware); // Add correlation ID tracking
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Stricter rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 uploads per hour
  message: 'Upload limit exceeded. Please try again later.',
});
app.use('/api/proofs/upload', uploadLimiter);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/proofs', authMiddleware, proofRoutes);
app.use('/api/approvals', authMiddleware, approvalRoutes);
app.use('/api/disputes', authMiddleware, disputeRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    // Connect to Redis
    await redisService.connect();
    logger.info('Redis connected successfully');

    // Start notification processor
    // notificationService.startNotificationProcessor();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    // Close Redis connection
    await redisService.disconnect();

    // Disconnect database
    await prisma.$disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, async () => {
  logger.info(`Payment Proof Service listening on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });

  // Initialize services after server starts
  await initializeServices();
});

// Start notification processor
const notificationService = new (require('./services/NotificationService').NotificationService)();
notificationService.startNotificationProcessor();