import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skip?: (request: NextRequest) => boolean; // Skip rate limiting for certain requests
  message?: string; // Custom error message
  statusCode?: number; // Custom status code (default: 429)
}

// Rate limit store interface
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limit store (for production, use Redis or similar)
export class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      const resetTime = now + windowMs;
      const newEntry = { count: 1, resetTime };
      this.store.set(key, newEntry);
      return newEntry;
    } else {
      // Increment existing count
      entry.count++;
      this.store.set(key, entry);
      return entry;
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
    logger.debug(`Rate limit store cleanup: ${this.store.size} entries remaining`);
  }

  clear(): void {
    this.store.clear();
  }

  getStats(): { totalKeys: number; totalRequests: number } {
    let totalRequests = 0;
    for (const entry of this.store.values()) {
      totalRequests += entry.count;
    }
    return {
      totalKeys: this.store.size,
      totalRequests
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global rate limit store instance
const rateLimitStore = new RateLimitStore();

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
    statusCode: 429
  },

  // Moderate limits for general API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many requests. Please try again later.',
    statusCode: 429
  },

  // Lenient limits for read-only endpoints
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // 120 requests per minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: 'Too many requests. Please try again later.',
    statusCode: 429
  },

  // Strict limits for financial operations
  financial: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 financial operations per minute
    message: 'Too many financial operations. Please try again later.',
    statusCode: 429
  },

  // Very strict limits for admin operations
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 admin operations per minute
    message: 'Too many admin operations. Please try again later.',
    statusCode: 429
  }
};

// Default key generator (by IP address)
function defaultKeyGenerator(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return `rate-limit:${ip}`;
}

// Rate limiting middleware function
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; response?: NextResponse; limit?: number; remaining?: number; resetTime?: number }> {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip,
    message = 'Too many requests. Please try again later.',
    statusCode = 429
  } = config;

  // Check if request should be skipped
  if (skip && skip(request)) {
    return { success: true };
  }

  // Generate rate limit key
  const key = keyGenerator(request);

  // Get current rate limit status
  const entry = rateLimitStore.increment(key, windowMs);
  const { count, resetTime } = entry;

  // Calculate headers
  const limit = maxRequests;
  const remaining = Math.max(0, maxRequests - count);
  const reset = Math.ceil((resetTime - Date.now()) / 1000); // seconds until reset

  // Check if limit exceeded
  if (count > maxRequests) {
    logger.warn(`Rate limit exceeded for key: ${key}`, {
      count,
      limit,
      resetTime,
      ip: request.headers.get('x-forwarded-for'),
      url: request.url,
      method: request.method
    }, request);

    // Create rate limit exceeded response
    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message,
        retryAfter: reset
      },
      {
        status: statusCode,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': reset.toString()
        }
      }
    );

    return {
      success: false,
      response,
      limit,
      remaining: 0,
      resetTime: resetTime
    };
  }

  // Request allowed, add rate limit headers to response
  const response = new Response();
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', reset.toString());

  return {
    success: true,
    limit,
    remaining,
    resetTime: resetTime
  };
}

// Helper function to create rate limited API route
export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const rateLimitResult = await rateLimit(request, config);

    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Call the original handler
    const response = await handler(request, ...args);

    // Add rate limit headers to successful responses
    if (response && rateLimitResult.limit !== undefined) {
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
      response.headers.set('X-RateLimit-Reset', Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000).toString());
    }

    return response;
  };
}

// Utility functions for different rate limit scenarios
export const createAuthRateLimit = (customConfig?: Partial<RateLimitConfig>) =>
  ({ ...RATE_LIMIT_CONFIGS.auth, ...customConfig });

export const createApiRateLimit = (customConfig?: Partial<RateLimitConfig>) =>
  ({ ...RATE_LIMIT_CONFIGS.api, ...customConfig });

export const createReadRateLimit = (customConfig?: Partial<RateLimitConfig>) =>
  ({ ...RATE_LIMIT_CONFIGS.read, ...customConfig });

export const createFinancialRateLimit = (customConfig?: Partial<RateLimitConfig>) =>
  ({ ...RATE_LIMIT_CONFIGS.financial, ...customConfig });

export const createAdminRateLimit = (customConfig?: Partial<RateLimitConfig>) =>
  ({ ...RATE_LIMIT_CONFIGS.admin, ...customConfig });

// User-specific rate limiting (by user ID)
export const createUserRateLimit = (userId: string, config: RateLimitConfig): RateLimitConfig => ({
  ...config,
  keyGenerator: () => `user-rate-limit:${userId}`
});

// IP-based rate limiting with custom window
export const createIPRateLimit = (windowMs: number, maxRequests: number): RateLimitConfig => ({
  windowMs,
  maxRequests,
  keyGenerator: defaultKeyGenerator
});

// Cleanup function for graceful shutdown
export function cleanupRateLimiter(): void {
  rateLimitStore.destroy();
  logger.info('Rate limiter cleaned up');
}

// Get rate limit statistics
export function getRateLimitStats() {
  return rateLimitStore.getStats();
}