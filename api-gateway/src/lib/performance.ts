// Performance Optimization Utilities
// Advanced performance monitoring and optimization for scale

import { CacheUtils } from '../services/shared/utils';

// Memory management utilities
export class MemoryManager {
  private static memoryThreshold = 100 * 1024 * 1024; // 100MB
  private static cleanupIntervals = new Map<string, NodeJS.Timeout>();

  // Monitor memory usage
  static async monitorMemoryUsage(): Promise<{
    used: number;
    total: number;
    percentage: number;
    status: 'healthy' | 'warning' | 'critical';
  }> {
    const usage = process.memoryUsage();

    const used = usage.heapUsed;
    const total = usage.heapTotal;
    const percentage = (used / total) * 100;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (percentage > 90) status = 'critical';
    else if (percentage > 75) status = 'warning';

    return { used, total, percentage, status };
  }

  // Setup automatic memory cleanup
  static setupMemoryCleanup(intervalMs: number = 300000): void { // 5 minutes
    const interval = setInterval(async () => {
      const memoryInfo = await this.monitorMemoryUsage();

      if (memoryInfo.status === 'critical') {
        console.warn('Critical memory usage detected, running cleanup...');
        await this.forceGarbageCollection();
        await this.clearAllCaches();
      } else if (memoryInfo.status === 'warning') {
        console.info('High memory usage detected, optimizing...');
        await this.optimizeMemory();
      }
    }, intervalMs);

    this.cleanupIntervals.set('memory', interval);
  }

  // Force garbage collection (Node.js specific)
  private static async forceGarbageCollection(): Promise<void> {
    if (global.gc) {
      global.gc();
    }
  }

  // Clear all caches
  private static async clearAllCaches(): Promise<void> {
    await CacheUtils.clear();
    console.log('All caches cleared');
  }

  // Memory optimization
  private static async optimizeMemory(): Promise<void> {
    // Clear expired cache entries
    await CacheUtils.clear();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  // Cleanup intervals
  static cleanup(): void {
    this.cleanupIntervals.forEach(interval => clearInterval(interval));
    this.cleanupIntervals.clear();
  }
}

// Database query optimization
export class QueryOptimizer {
  // Query result caching with intelligent invalidation
  private static queryCache = new Map<string, {
    result: any;
    timestamp: number;
    ttl: number;
  }>();

  // Cache query results
  static async cacheQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = this.queryCache.get(key);

    if (cached && (Date.now() - cached.timestamp) < (cached.ttl * 1000)) {
      return cached.result;
    }

    const result = await queryFn();
    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });

    return result;
  }

  // Batch similar queries
  static async batchQueries<T>(
    queries: Array<{ key: string; query: () => Promise<T>; ttl?: number }>
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    // Execute all queries in parallel
    const promises = queries.map(async ({ key, query, ttl = 300 }) => {
      try {
        const result = await this.cacheQuery(key, query, ttl);
        results.set(key, result);
      } catch (error) {
        console.error(`Query failed for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  // Clear query cache
  static clearQueryCache(pattern?: string): void {
    if (pattern) {
      for (const [key] of this.queryCache) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }
}

// Response time optimization
export class ResponseOptimizer {
  // Compress responses for better performance
  static compressResponse(data: any): string {
    return JSON.stringify(data);
  }

  // Optimize images (placeholder for image optimization service)
  static async optimizeImage(imageBuffer: Buffer): Promise<Buffer> {
    // In production, integrate with image optimization service
    // For now, return as-is
    return imageBuffer;
  }

  // Bundle and minify assets
  static async optimizeAssets(): Promise<void> {
    // In production, this would minify CSS/JS bundles
    console.log('Assets optimization would run here');
  }
}

// Load testing utilities
export class LoadTestUtils {
  // Simulate concurrent users
  static async simulateConcurrentUsers(
    endpoint: string,
    userCount: number,
    durationSeconds: number
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsPerSecond: number;
  }> {
    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [] as number[],
    };

    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);

    // Simulate concurrent requests
    const promises = Array.from({ length: userCount }, async (_, index) => {
      while (Date.now() < endTime) {
        const requestStart = performance.now();

        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'User-Agent': `LoadTest-User-${index}` },
          });

          const requestEnd = performance.now();
          results.responseTimes.push(requestEnd - requestStart);
          results.totalRequests++;

          if (response.ok) {
            results.successfulRequests++;
          } else {
            results.failedRequests++;
          }
        } catch (error) {
          results.failedRequests++;
          results.totalRequests++;
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    await Promise.allSettled(promises);

    const totalDuration = (Date.now() - startTime) / 1000;
    const averageResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;

    return {
      totalRequests: results.totalRequests,
      successfulRequests: results.successfulRequests,
      failedRequests: results.failedRequests,
      averageResponseTime: averageResponseTime || 0,
      requestsPerSecond: results.totalRequests / totalDuration,
    };
  }
}

// Application performance monitoring
export class AppPerformanceMonitor {
  private static metrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    activeConnections: 0,
  };

  // Record request metrics
  static recordRequest(duration: number, success: boolean): void {
    this.metrics.requestCount++;

    if (!success) {
      this.metrics.errorCount++;
    }

    // Update average response time
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + duration) / this.metrics.requestCount;
  }

  // Get current metrics
  static async getMetrics(): Promise<typeof AppPerformanceMonitor.metrics & {
    uptime: number;
    memoryUsage: number;
    errorRate: number;
  }> {
    const uptime = process.uptime();
    const memoryUsage = (await MemoryManager.monitorMemoryUsage()).used;
    const errorRate = this.metrics.requestCount > 0 ? (this.metrics.errorCount / this.metrics.requestCount) * 100 : 0;

    return {
      ...this.metrics,
      uptime,
      memoryUsage,
      errorRate,
    };
  }

  // Reset metrics
  static resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      activeConnections: 0,
    };
  }
}

// Initialize performance monitoring
export function initializePerformanceMonitoring(): void {
  // In production, this would initialize proper monitoring
  // For now, we'll keep it silent to avoid console clutter
  // console.log('🚀 Initializing performance monitoring...');

  // Setup memory monitoring (commented out for production)
  // MemoryManager.setupMemoryCleanup();

  // Setup periodic metrics logging (commented out for production)
  // setInterval(async () => {
  //   const metrics = await AppPerformanceMonitor.getMetrics();
  //   console.log('📊 Performance Metrics:', {
  //     requests: metrics.requestCount,
  //     errors: metrics.errorCount,
  //     avgResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
  //     memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
  //     errorRate: `${metrics.errorRate.toFixed(2)}%`,
  //     uptime: `${(metrics.uptime / 3600).toFixed(2)}h`,
  //   });
  // }, 60000); // Log every minute

  // console.log('✅ Performance monitoring initialized');
}

// Cleanup performance monitoring
export function cleanupPerformanceMonitoring(): void {
  // In production, this would clean up monitoring resources
  // For now, we'll keep it silent to avoid console clutter
  // MemoryManager.cleanup();
  // AppPerformanceMonitor.resetMetrics();
  // QueryOptimizer.clearQueryCache();
  // console.log('🧹 Performance monitoring cleaned up');
}
