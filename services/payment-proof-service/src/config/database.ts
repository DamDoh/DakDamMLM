import { PrismaClient } from '@prisma/client';
import { logger } from '../index';

const prismaConfig: any = {
  log: process.env.NODE_ENV === 'development' ? [
    { level: 'query' as const, emit: 'event' as const },
    { level: 'info' as const, emit: 'event' as const },
    { level: 'warn' as const, emit: 'event' as const },
    { level: 'error' as const, emit: 'event' as const }
  ] : [
    { level: 'warn' as const, emit: 'event' as const },
    { level: 'error' as const, emit: 'event' as const }
  ],
};

// Create Prisma client with enhanced configuration
export const prisma = new PrismaClient(prismaConfig);

// Log database queries in development - commented out due to Prisma type issues
// if (process.env.NODE_ENV === 'development') {
//   (prisma as any).$on('query', (e: any) => {
//     logger.debug(`Database Query: ${e.query}`, {
//       duration: e.duration,
//       params: e.params,
//       target: e.target
//     });
//   });
// }

// Health check function
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  responseTime: number;
  connectionCount?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1 as health_check`;

    const responseTime = Date.now() - startTime;

    // Get connection pool stats if available
    let connectionCount: number | undefined;
    try {
      // This is a simplified way to check connections
      // In production, you might want to use a connection pool monitoring tool
      const result = await prisma.$queryRaw`SELECT count(*) as connections FROM pg_stat_activity WHERE datname = current_database()`;
      connectionCount = parseInt((result as any)[0].connections);
    } catch {
      // Connection count not available
    }

    return {
      healthy: true,
      responseTime,
      connectionCount
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      healthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Connection pool monitoring
export function startConnectionPoolMonitoring(): void {
  const monitoringInterval = parseInt(process.env.DB_MONITORING_INTERVAL || '30000'); // 30 seconds

  setInterval(async () => {
    try {
      const health = await checkDatabaseHealth();

      if (!health.healthy) {
        logger.error('Database health check failed', {
          responseTime: health.responseTime,
          error: health.error
        });
      } else {
        logger.debug('Database health check passed', {
          responseTime: health.responseTime,
          connectionCount: health.connectionCount
        });
      }
    } catch (error) {
      logger.error('Database monitoring error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, monitoringInterval);
}

// Initialize connection pool monitoring
if (process.env.NODE_ENV === 'production') {
  startConnectionPoolMonitoring();
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, disconnecting database');
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, disconnecting database');
  await disconnectDatabase();
});