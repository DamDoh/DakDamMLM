// Performance Monitoring and Caching System
// Provides comprehensive performance tracking, caching, and optimization

import { NextRequest } from 'next/server';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  cacheHit?: boolean;
  databaseQueries?: number;
  memoryUsage?: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static cache = new Map<string, CacheEntry<any>>();
  private static readonly MAX_METRICS = 10000;
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Record API performance metrics
   */
  static recordMetrics(request: NextRequest, response: Response, duration: number, additional?: Partial<PerformanceMetrics>) {
    const metrics: PerformanceMetrics = {
      endpoint: this.getEndpointFromUrl(request.url),
      method: request.method,
      statusCode: response.status,
      duration,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      ...additional
    };

    this.metrics.push(metrics);

    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow API request detected: ${metrics.endpoint} took ${duration}ms`);
    }

    return metrics;
  }

  /**
   * Get performance statistics
   */
  static getStats(timeRange: number = 60 * 60 * 1000): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number; avgTime: number }>;
    cacheStats: { hits: number; misses: number; hitRate: number };
  } {
    const cutoffTime = Date.now() - timeRange;
    const recentMetrics = this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoffTime);

    const totalRequests = recentMetrics.length;
    const averageResponseTime = totalRequests > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests
      : 0;

    const slowRequests = recentMetrics.filter(m => m.duration > 1000).length;
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    // Top endpoints by usage
    const endpointStats = new Map<string, { count: number; totalTime: number }>();
    recentMetrics.forEach(metric => {
      const current = endpointStats.get(metric.endpoint) || { count: 0, totalTime: 0 };
      current.count++;
      current.totalTime += metric.duration;
      endpointStats.set(metric.endpoint, current);
    });

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgTime: Math.round(stats.totalTime / stats.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cache statistics
    const cacheStats = this.getCacheStats();

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      slowRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      topEndpoints,
      cacheStats
    };
  }

  /**
   * Enhanced caching with performance tracking
   */
  static getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (entry && Date.now() < entry.timestamp + entry.ttl) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      return entry.data;
    }

    if (entry) {
      this.cache.delete(key); // Remove expired entry
    }

    return null;
  }

  static setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }

  static getCacheStats(): { hits: number; misses: number; hitRate: number; totalEntries: number } {
    // This is a simplified version - in production you'd track hits/misses properly
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: this.cache.size
    };
  }

  static clearCache(): void {
    this.cache.clear();
  }

  private static getEndpointFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      return `/${pathParts.slice(0, 2).join('/')}`; // Get first two path segments
    } catch {
      return '/unknown';
    }
  }
}

/**
 * Performance middleware for API routes
 */
export function withPerformanceMonitoring<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const startTime = Date.now();

    try {
      const response = await handler(request, ...args);
      const duration = Date.now() - startTime;

      // Record metrics asynchronously to avoid blocking response
      setTimeout(() => {
        PerformanceMonitor.recordMetrics(request, response, duration);
      }, 0);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResponse = new Response('Internal Server Error', { status: 500 });

      // Record error metrics
      setTimeout(() => {
        PerformanceMonitor.recordMetrics(request, errorResponse, duration, {
          statusCode: 500
        });
      }, 0);

      throw error;
    }
  };
}

/**
 * Cache decorator for expensive operations
 */
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl: number = PerformanceMonitor['DEFAULT_TTL']
) {
  return async (...args: T): Promise<R> => {
    const cacheKey = keyGenerator(...args);
    const cached = PerformanceMonitor.getCache<R>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    PerformanceMonitor.setCache(cacheKey, result, ttl);

    return result;
  };
}

/**
 * Database query performance tracker
 */
export class DatabasePerformanceTracker {
  private static queryCount = 0;
  private static totalQueryTime = 0;

  static startQuery(): { id: string; startTime: number } {
    const id = `query-${Date.now()}-${++this.queryCount}`;
    return { id, startTime: Date.now() };
  }

  static endQuery(queryInfo: { id: string; startTime: number }): number {
    const duration = Date.now() - queryInfo.startTime;
    this.totalQueryTime += duration;
    return duration;
  }

  static getStats(): { totalQueries: number; averageQueryTime: number; totalQueryTime: number } {
    return {
      totalQueries: this.queryCount,
      averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      totalQueryTime: this.totalQueryTime
    };
  }

  static reset(): void {
    this.queryCount = 0;
    this.totalQueryTime = 0;
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  static getMemoryUsage(): { used: number; total: number; percentage: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const used = usage.heapUsed / 1024 / 1024; // MB
      const total = usage.heapTotal / 1024 / 1024; // MB
      const percentage = (used / total) * 100;

      return {
        used: Math.round(used * 100) / 100,
        total: Math.round(total * 100) / 100,
        percentage: Math.round(percentage * 100) / 100
      };
    }

    return { used: 0, total: 0, percentage: 0 };
  }
}

/**
 * Health check endpoint data
 */
export function getHealthCheckData() {
  const performanceStats = PerformanceMonitor.getStats();
  const memoryUsage = MemoryTracker.getMemoryUsage();
  const cacheStats = PerformanceMonitor.getCacheStats();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.round(process.uptime()) : 0,
    performance: performanceStats,
    memory: memoryUsage,
    cache: cacheStats,
    version: '1.0.0'
  };
}