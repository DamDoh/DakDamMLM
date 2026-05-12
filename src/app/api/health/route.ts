import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { PerformanceMonitor, DatabasePerformanceTracker } from '@/lib/performance-monitor';
import { createClient } from 'redis';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check database connectivity with performance tracking
    let dbConnected = false;
    let dbDuration = 0;
    let redisConnected = false;
    let redisDuration = 0;

    try {
      const dbQuery = DatabasePerformanceTracker.startQuery();
      await prisma.$queryRaw`SELECT 1`;
      dbDuration = DatabasePerformanceTracker.endQuery(dbQuery);
      dbConnected = true;
    } catch (dbError) {
      console.warn('Database health check failed:', dbError instanceof Error ? dbError.message : 'Unknown error');
      dbDuration = 0;
    }

    if (process.env.REDIS_URL) {
      const redisClient = createClient({ url: process.env.REDIS_URL });
      try {
        const redisStart = Date.now();
        await redisClient.connect();
        await redisClient.ping();
        redisDuration = Date.now() - redisStart;
        redisConnected = true;
      } catch (redisError) {
        console.warn('Redis health check failed:', redisError instanceof Error ? redisError.message : 'Unknown error');
        redisDuration = 0;
      } finally {
        try {
          await redisClient.disconnect();
        } catch {
          // ignore disconnect errors during health checks
        }
      }
    }

    // Get comprehensive performance metrics
    const performanceStats = PerformanceMonitor.getStats();
    const dbStats = DatabasePerformanceTracker.getStats();

    // Check application health
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100 * 100) / 100
      },
      version: process.version,
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbConnected ? 'connected' : 'disconnected',
        responseTime: dbConnected ? `${dbDuration}ms` : 'N/A',
        stats: dbStats,
        connectionAvailable: dbConnected
      },
      redis: {
        status: process.env.REDIS_URL ? (redisConnected ? 'connected' : 'disconnected') : 'disabled',
        responseTime: process.env.REDIS_URL ? (redisConnected ? `${redisDuration}ms` : 'N/A') : 'disabled',
        endpoint: process.env.REDIS_URL || 'not configured'
      },
      performance: {
        totalRequests: performanceStats.totalRequests,
        averageResponseTime: performanceStats.averageResponseTime,
        slowRequests: performanceStats.slowRequests,
        errorRate: performanceStats.errorRate,
        topEndpoints: performanceStats.topEndpoints.slice(0, 5) // Top 5 only
      },
      cache: PerformanceMonitor.getCacheStats()
    };

    const duration = Date.now() - startTime;
    logger.info('Health check completed', { duration, status: 'healthy' }, request);

    return NextResponse.json(healthCheck, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    }, request);

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

// Support HEAD requests for load balancer health checks
export async function HEAD(request: NextRequest) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}