// Performance Metrics API Endpoint
// Provides detailed performance analytics and monitoring data

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { PerformanceMonitor, MemoryTracker, DatabasePerformanceTracker } from '@/lib/performance-monitor';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for metrics access
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for performance metrics API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      logger.warn('Unauthorized attempt to access performance metrics', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return authenticatedRequest;
    }

    const { searchParams } = new URL(request.url);
    const timeRange = parseInt(searchParams.get('range') || '3600000'); // Default 1 hour
    const includeDetails = searchParams.get('details') === 'true';

    // Get performance statistics
    const performanceStats = PerformanceMonitor.getStats(timeRange);
    const memoryUsage = MemoryTracker.getMemoryUsage();
    const dbStats = DatabasePerformanceTracker.getStats();

    // Get cache statistics from analytics service if available
    let analyticsCacheStats = { hits: 0, misses: 0, hitRate: 0, totalEntries: 0 };
    try {
      // This would need to be implemented in the analytics service
      // For now, return basic cache stats
      analyticsCacheStats = PerformanceMonitor.getCacheStats();
    } catch (error) {
      logger.warn('Could not retrieve analytics cache stats', { error });
    }

    const metricsData = {
      summary: {
        totalRequests: performanceStats.totalRequests,
        averageResponseTime: performanceStats.averageResponseTime,
        slowRequests: performanceStats.slowRequests,
        errorRate: performanceStats.errorRate,
        uptime: process.uptime ? Math.round(process.uptime()) : 0
      },
      performance: {
        averageResponseTime: performanceStats.averageResponseTime,
        requestsPerMinute: Math.round((performanceStats.totalRequests / (timeRange / 60000)) * 100) / 100,
        slowRequestPercentage: performanceStats.totalRequests > 0
          ? Math.round((performanceStats.slowRequests / performanceStats.totalRequests) * 100 * 100) / 100
          : 0
      },
      memory: memoryUsage,
      database: dbStats,
      cache: {
        performance: PerformanceMonitor.getCacheStats(),
        analytics: analyticsCacheStats
      },
      topEndpoints: performanceStats.topEndpoints,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Include detailed metrics if requested
    if (includeDetails) {
      (metricsData as any).details = {
        rawMetrics: PerformanceMonitor['metrics'].slice(-100), // Last 100 requests
        memoryTrend: await getMemoryTrend(),
        errorBreakdown: await getErrorBreakdown(timeRange)
      };
    }

    const duration = Date.now() - startTime;
    logger.info('Performance metrics retrieved', {
      userId: (authenticatedRequest as any).user?.id,
      timeRange,
      includeDetails,
      duration
    }, request);

    return ApiResponseUtil.success(
      metricsData,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Performance metrics API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return ApiResponseUtil.unauthorized();
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

// Helper functions for detailed metrics
async function getMemoryTrend(): Promise<Array<{ timestamp: string; usage: number }>> {
  // In a real implementation, you'd store memory snapshots over time
  // For now, return current memory state
  const memoryUsage = MemoryTracker.getMemoryUsage();
  return [{
    timestamp: new Date().toISOString(),
    usage: memoryUsage.percentage
  }];
}

async function getErrorBreakdown(timeRange: number): Promise<Record<string, number>> {
  const cutoffTime = Date.now() - timeRange;
  const recentMetrics = PerformanceMonitor['metrics'].filter(
    m => m.statusCode >= 400 && new Date(m.timestamp).getTime() > cutoffTime
  );

  const errorBreakdown: Record<string, number> = {};
  recentMetrics.forEach(metric => {
    const errorType = `${metric.statusCode}`;
    errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
  });

  return errorBreakdown;
}