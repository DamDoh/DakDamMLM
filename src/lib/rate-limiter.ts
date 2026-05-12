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

// In-memory rate limit store
// NOTE: For 100M+ users in production, this should be replaced with Redis or a distributed cache
// to handle the scale and provide shared rate limiting across multiple server instances.
// Current in-memory implementation is suitable for single-instance deployments.
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 1 minute for better memory management at scale
    // For 100M+ users, consider using Redis or distributed cache instead of in-memory store
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 1 minute cleanup for better scalability
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

  delete(key: string): void {
    this.store.delete(key);
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

  // Get all keys (for pattern matching)
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  // Clear keys matching a pattern
  clearByPattern(pattern: string): number {
    let cleared = 0;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        cleared++;
      }
    }
    return cleared;
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
// Optimized for 100M+ users scale
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100000, // 100000 attempts per 15 minutes (optimized for 100M users)
    skipSuccessfulRequests: true, // Don't count successful logins
    message: 'Too many authentication attempts. Please try again later.',
    statusCode: 429
  },

  // Moderate limits for general API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100000, // 100000 requests per minute (optimized for 100M users)
    message: 'Too many requests. Please try again later.',
    statusCode: 429
  },

  // Lenient limits for read-only endpoints
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100000, // 100000 requests per minute (optimized for 100M users)
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: 'Too many requests. Please try again later.',
    statusCode: 429
  },

  // Strict limits for financial operations
  financial: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 financial operations per minute (increased for scale)
    message: 'Too many financial operations. Please try again later.',
    statusCode: 429
  },

  // Very strict limits for admin operations
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 admin operations per minute (increased for scale)
    message: 'Too many admin operations. Please try again later.',
    statusCode: 429
  }
};

// Extract real client IP from headers (handles nginx proxy correctly)
function extractClientIP(request: NextRequest): string {
  // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
  // We want the first (original client) IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Split by comma and take the first IP, trim whitespace
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP && firstIP !== '::1' && firstIP !== '127.0.0.1') return firstIP;
  }
  
  // Fallback to x-real-ip (nginx sets this to the original client IP)
  const realIP = request.headers.get('x-real-ip');
  if (realIP && realIP !== '::1' && realIP !== '127.0.0.1') return realIP.trim();
  
  // Check cf-connecting-ip (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP && cfIP !== '::1' && cfIP !== '127.0.0.1') return cfIP.trim();
  
  // Last resort: return unknown (NextRequest doesn't have direct IP access)
  // In development, use a more specific key to avoid all requests being grouped
  if (process.env.NODE_ENV === 'development') {
    const userAgent = request.headers.get('user-agent') || 'unknown';
    return `dev-${userAgent.substring(0, 20)}`;
  }
  return 'unknown';
}

// Default key generator (by IP address)
function defaultKeyGenerator(request: NextRequest): string {
  const ip = extractClientIP(request);
  return `rate-limit:${ip}`;
}

// Rate limiting middleware function
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; response?: NextResponse; limit?: number; remaining?: number; resetTime?: number; decrement?: () => void }> {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip,
    skipSuccessfulRequests = false,
    message = 'Too many requests. Please try again later.',
    statusCode = 429
  } = config;

  // Check if request should be skipped
  if (skip && skip(request)) {
    return { success: true };
  }

  // In development, allow bypassing rate limit with a special header
  if (process.env.NODE_ENV === 'development' && request.headers.get('x-bypass-rate-limit') === 'true') {
    logger.debug('Rate limit bypassed in development mode', {}, request);
    return { success: true, limit: maxRequests, remaining: maxRequests };
  }

  // Generate rate limit key
  const key = keyGenerator(request);

  // Get current rate limit status (increment count)
  const entry = rateLimitStore.increment(key, windowMs);
  const { count, resetTime } = entry;
  
  // Create decrement function for successful requests (if skipSuccessfulRequests is enabled)
  const decrement = skipSuccessfulRequests ? () => {
    const currentEntry = rateLimitStore.get(key);
    if (currentEntry && currentEntry.count > 0) {
      currentEntry.count--;
      // If count reaches 0, delete the entry to free up memory
      if (currentEntry.count === 0) {
        rateLimitStore.delete(key);
      }
    }
  } : undefined;

  // Calculate headers
  const limit = maxRequests;
  const remaining = Math.max(0, maxRequests - count);
  const reset = Math.ceil((resetTime - Date.now()) / 1000); // seconds until reset

  // Check if limit exceeded
  if (count > maxRequests) {
    const clientIP = extractClientIP(request);
    const retryAfterMinutes = Math.ceil(reset / 60);
    
    logger.warn(`Rate limit exceeded for key: ${key}`, {
      count,
      limit,
      resetTime,
      ip: clientIP,
      url: request.url,
      method: request.method,
      retryAfterMinutes
    }, request);

    // Create rate limit exceeded response with helpful message
    // If message already contains retry info, use it; otherwise append retry time
    const finalMessage = message.includes('try again') || message.includes('retry')
      ? `${message} Please wait ${retryAfterMinutes} minute${retryAfterMinutes !== 1 ? 's' : ''} before trying again.`
      : `Too many requests. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes !== 1 ? 's' : ''}.`;
    
    const response = NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        message: finalMessage,
        retryAfter: reset,
        retryAfterMinutes
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
    resetTime: resetTime,
    decrement
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

// Clear rate limit for a specific key (useful for debugging)
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
  logger.info(`Rate limit cleared for key: ${key}`);
}

// Clear rate limit for a specific IP address
export function clearRateLimitByIP(ip: string): void {
  const key = `rate-limit:${ip}`;
  rateLimitStore.delete(key);
  logger.info(`Rate limit cleared for IP: ${ip}`);
}

// Clear all rate limits (use with caution)
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  logger.warn('All rate limits cleared');
}

// Clear rate limits matching a pattern (e.g., all auth rate limits)
export function clearRateLimitsByPattern(pattern: string): void {
  const cleared = rateLimitStore.clearByPattern(pattern);
  logger.info(`Cleared ${cleared} rate limit entries matching pattern: ${pattern}`);
}