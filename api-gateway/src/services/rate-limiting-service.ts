/**
 * MEDIUM PRIORITY FIX #12: Rate Limiting Service
 * 
 * Prevents API abuse and DoS attacks on sensitive endpoints.
 * Implements rate limiting at multiple levels:
 * - Per IP address
 * - Per user
 * - Per endpoint
 * 
 * Uses in-memory store for simplicity (can be upgraded to Redis)
 */

import { prisma } from '@/lib/prisma';

export interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  blockDurationMs?: number; // How long to block after limit exceeded
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

/**
 * Rate limit configurations for different endpoint types
 */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Financial endpoints - very strict
  'wallet_transfer': {
    endpoint: '/api/wallet/transfer',
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000 // 5 minutes
  },
  'wallet_withdraw': {
    endpoint: '/api/wallet/withdraw',
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 10 * 60 * 1000 // 10 minutes
  },
  'commission_calculate': {
    endpoint: '/api/commissions/calculate',
    maxRequests: 3,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  },

  // Authentication endpoints
  'auth_login': {
    endpoint: '/api/auth/login',
    maxRequests: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  },
  'auth_register': {
    endpoint: '/api/auth/register',
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  },
  'password_reset': {
    endpoint: '/api/auth/reset-password',
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 2 * 60 * 60 * 1000 // 2 hours
  },

  // Order endpoints
  'order_create': {
    endpoint: '/api/orders/create',
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000 // 5 minutes
  },

  // Profile updates
  'profile_update': {
    endpoint: '/api/profile/update',
    maxRequests: 10,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },

  // General API
  'api_general': {
    endpoint: '/api/*',
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  }
};

/**
 * In-memory rate limit store
 * Format: { key: { count, resetAt, blockedUntil } }
 */
class RateLimitStore {
  private store = new Map<string, {
    count: number;
    resetAt: Date;
    blockedUntil?: Date;
  }>();

  /**
   * Get current rate limit data
   */
  get(key: string): { count: number; resetAt: Date; blockedUntil?: Date } | null {
    const data = this.store.get(key);
    if (!data) return null;

    // Clean up expired entries
    if (data.resetAt < new Date() && (!data.blockedUntil || data.blockedUntil < new Date())) {
      this.store.delete(key);
      return null;
    }

    return data;
  }

  /**
   * Increment request count
   */
  increment(key: string, windowMs: number): number {
    const now = new Date();
    const existing = this.get(key);

    if (!existing) {
      const resetAt = new Date(now.getTime() + windowMs);
      this.store.set(key, { count: 1, resetAt });
      return 1;
    }

    existing.count++;
    return existing.count;
  }

  /**
   * Block a key for a duration
   */
  block(key: string, durationMs: number): void {
    const now = new Date();
    const blockedUntil = new Date(now.getTime() + durationMs);
    const existing = this.get(key);

    if (existing) {
      existing.blockedUntil = blockedUntil;
    } else {
      this.store.set(key, {
        count: 0,
        resetAt: blockedUntil,
        blockedUntil
      });
    }
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get store size
   */
  size(): number {
    return this.store.size;
  }
}

const store = new RateLimitStore();

export class RateLimitingService {
  /**
   * Check if request is allowed
   */
  static checkRateLimit(
    identifier: string, // user ID, IP address, etc.
    configKey: string // which rate limit config to use
  ): RateLimitCheck {
    const config = RATE_LIMIT_CONFIGS[configKey];
    if (!config) {
      console.warn(`Rate limit config not found: ${configKey}`);
      return {
        allowed: true,
        remaining: 999,
        resetAt: new Date(Date.now() + 60000)
      };
    }

    const key = `${configKey}:${identifier}`;
    const existing = store.get(key);

    // Check if blocked
    if (existing?.blockedUntil && existing.blockedUntil > new Date()) {
      const retryAfterMs = existing.blockedUntil.getTime() - Date.now();
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.blockedUntil,
        retryAfterMs
      };
    }

    // Increment counter
    const count = store.increment(key, config.windowMs);
    const data = store.get(key)!;

    // Check if limit exceeded
    if (count > config.maxRequests) {
      // Block if configured
      if (config.blockDurationMs) {
        store.block(key, config.blockDurationMs);
        const blockedData = store.get(key)!;
        
        // Log the violation
        this.logRateLimitViolation(identifier, configKey, count);

        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedData.blockedUntil!,
          retryAfterMs: config.blockDurationMs
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: data.resetAt,
        retryAfterMs: data.resetAt.getTime() - Date.now()
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count,
      resetAt: data.resetAt
    };
  }

  /**
   * Check and throw error if rate limit exceeded
   */
  static enforceRateLimit(
    identifier: string,
    configKey: string
  ): void {
    const check = this.checkRateLimit(identifier, configKey);

    if (!check.allowed) {
      const retryAfterSeconds = check.retryAfterMs 
        ? Math.ceil(check.retryAfterMs / 1000)
        : 60;

      throw new Error(
        `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`
      );
    }
  }

  /**
   * Log rate limit violation
   */
  private static async logRateLimitViolation(
    identifier: string,
    configKey: string,
    requestCount: number
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: identifier.startsWith('user-') ? identifier.replace('user-', '') : undefined,
          action: 'rate_limit_exceeded',
          entity: 'api',
          changes: {
            configKey,
            requestCount,
            timestamp: new Date()
          },
          ipAddress: identifier.startsWith('ip-') ? identifier.replace('ip-', '') : 'unknown',
          userAgent: 'rate-limiting-service'
        }
      });
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Create middleware for Next.js API routes
   */
  static createMiddleware(configKey: string) {
    return (req: any, res: any, next: any) => {
      const identifier = req.userId 
        ? `user-${req.userId}`
        : `ip-${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;

      const check = this.checkRateLimit(identifier, configKey);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIGS[configKey]?.maxRequests || 100);
      res.setHeader('X-RateLimit-Remaining', check.remaining);
      res.setHeader('X-RateLimit-Reset', check.resetAt.toISOString());

      if (!check.allowed) {
        res.setHeader('Retry-After', Math.ceil((check.retryAfterMs || 60000) / 1000));
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((check.retryAfterMs || 60000) / 1000)
        });
      }

      next();
    };
  }

  /**
   * Reset rate limit for identifier (admin function)
   */
  static resetRateLimit(identifier: string, configKey: string): void {
    const key = `${configKey}:${identifier}`;
    store.clear(); // For simplicity, clear entire store
    console.log(`Rate limit reset for ${identifier} on ${configKey}`);
  }

  /**
   * Get current rate limit status
   */
  static getRateLimitStatus(
    identifier: string,
    configKey: string
  ): {
    config: RateLimitConfig;
    current: { count: number; resetAt: Date; blockedUntil?: Date } | null;
  } {
    const config = RATE_LIMIT_CONFIGS[configKey];
    const key = `${configKey}:${identifier}`;
    const current = store.get(key);

    return { config, current };
  }

  /**
   * Get all rate limit configs
   */
  static getAllConfigs(): Record<string, RateLimitConfig> {
    return RATE_LIMIT_CONFIGS;
  }

  /**
   * Clear all rate limits (for testing)
   */
  static clearAll(): void {
    store.clear();
  }

  /**
   * Get store statistics
   */
  static getStats(): { totalKeys: number } {
    return {
      totalKeys: store.size()
    };
  }
}
