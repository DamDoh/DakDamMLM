import express, { Request, Response } from 'express';
import { prisma } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    (res as any).status(200).json({
      status: 'healthy',
      service: 'payment-proof-service',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    (res as any).status(503).json({
      status: 'unhealthy',
      service: 'payment-proof-service',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    // More comprehensive health check
    await prisma.$queryRaw`SELECT 1`;

    // Check if required environment variables are set
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      return (res as any).status(503).json({
        status: 'not ready',
        service: 'payment-proof-service',
        error: `Missing required environment variables: ${missingVars.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    (res as any).status(200).json({
      status: 'ready',
      service: 'payment-proof-service',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    (res as any).status(503).json({
      status: 'not ready',
      service: 'payment-proof-service',
      error: 'Service not ready',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as healthRoutes };