// Advanced Rate Limiting Service
// Implements sophisticated rate limiting with Redis backing and DDoS protection

import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (request: Request) => string; // Custom key generator
  skip?: (request: Request) => boolean; // Skip rate limiting for certain requests
  onLimitReached?: (key: string, config: RateLimitConfig) => void; // Callback when limit reached
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
  blockedUntil?: number;
}

export interface DDoSProtectionConfig {
  enabled: boolean;
  maxConcurrentConnections: number;
  suspiciousPatterns: RegExp[];
  blockDuration: number; // Block duration in milliseconds
  whitelist: string[]; // IP addresses to whitelist
  blacklist: string[]; // IP addresses to blacklist
}

class AdvancedRateLimitService {
  private static instance: AdvancedRateLimitService;
  private redis: Redis;
  private configs = new Map<string, RateLimitConfig>();
  private ddosConfig: DDoSProtectionConfig;

  private constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    this.ddosConfig = {
      enabled: true,
      maxConcurrentConnections: 100,
      suspiciousPatterns: [
        /\b(union|select|insert|delete|update|drop|create|alter)\b/i,
        /\b(script|javascript|vbscript|onload|onerror)\b/i,
        /\b(eval|exec|system|shell_exec)\b/i,
      ],
      blockDuration: 15 * 60 * 1000, // 15 minutes
      whitelist: process.env.IP_WHITELIST?.split(',') || [],
      blacklist: process.env.IP_BLACKLIST?.split(',') || [],
    };

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
  }

  static getInstance(): AdvancedRateLimitService {
    if (!AdvancedRateLimitService.instance) {
      AdvancedRateLimitService.instance = new AdvancedRateLimitService();
    }
    return AdvancedRateLimitService.instance;
  }

  // Register a rate limit configuration
  registerConfig(identifier: string, config: RateLimitConfig): void {
    this.configs.set(identifier, config);
  }

  // Check rate limit for a request
  async checkLimit(
    identifier: string,
    request: Request,
    customKey?: string
  ): Promise<RateLimitResult> {
    const config = this.configs.get(identifier);
    if (!config) {
      throw new Error(`Rate limit config not found: ${identifier}`);
    }

    // Check if request should be skipped
    if (config.skip?.(request)) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        totalRequests: 0,
      };
    }

    // Generate rate limit key
    const key = customKey || config.keyGenerator?.(request) || this.generateKey(request);

    // Check DDoS protection first
    const ddosCheck = await this.checkDDoSProtection(request);
    if (!ddosCheck.allowed) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + this.ddosConfig.blockDuration,
        totalRequests: 0,
        blockedUntil: ddosCheck.blockedUntil,
      };
    }

    try {
      const now = Date.now();
      const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
      const windowKey = `${key}:${windowStart}`;

      // Get current request count
      const currentCount = parseInt(await this.redis.get(windowKey) || '0');

      // Check if limit exceeded
      if (currentCount >= config.maxRequests) {
        const resetTime = windowStart + config.windowMs;

        // Call limit reached callback
        config.onLimitReached?.(key, config);

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          totalRequests: currentCount,
        };
      }

      // Increment counter
      const newCount = await this.redis.incr(windowKey);

      // Set expiry on first request in window
      if (newCount === 1) {
        await this.redis.pexpire(windowKey, config.windowMs);
      }

      const resetTime = windowStart + config.windowMs;
      const remaining = Math.max(0, config.maxRequests - newCount);

      return {
        allowed: true,
        remaining,
        resetTime,
        totalRequests: newCount,
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Allow request on Redis failure to avoid blocking legitimate traffic
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        totalRequests: 0,
      };
    }
  }

  // DDoS protection check
  private async checkDDoSProtection(request: Request): Promise<{ allowed: boolean; blockedUntil?: number }> {
    if (!this.ddosConfig.enabled) {
      return { allowed: true };
    }

    const ip = this.getClientIP(request);

    // Check whitelist
    if (this.ddosConfig.whitelist.includes(ip)) {
      return { allowed: true };
    }

    // Check blacklist
    if (this.ddosConfig.blacklist.includes(ip)) {
      return { allowed: false, blockedUntil: Date.now() + this.ddosConfig.blockDuration };
    }

    // Check for suspicious patterns
    const userAgent = request.headers.get('user-agent') || '';
    const url = request.url;
    const body = await this.getRequestBody(request);

    const suspiciousContent = `${url} ${userAgent} ${body}`.toLowerCase();

    for (const pattern of this.ddosConfig.suspiciousPatterns) {
      if (pattern.test(suspiciousContent)) {
        logger.warn('Suspicious request pattern detected', { ip, url, userAgent: userAgent.substring(0, 100) });

        // Block suspicious IP for a period
        await this.blockIP(ip, this.ddosConfig.blockDuration);

        return { allowed: false, blockedUntil: Date.now() + this.ddosConfig.blockDuration };
      }
    }

    // Check concurrent connections
    const connections = await this.getConcurrentConnections(ip);
    if (connections > this.ddosConfig.maxConcurrentConnections) {
      logger.warn('Too many concurrent connections', { ip, connections });
      return { allowed: false, blockedUntil: Date.now() + 60000 }; // Block for 1 minute
    }

    return { allowed: true };
  }

  // Block an IP address
  private async blockIP(ip: string, duration: number): Promise<void> {
    const key = `blocked:${ip}`;
    await this.redis.set(key, '1', 'PX', duration);
  }

  // Check if IP is blocked
  async isBlocked(ip: string): Promise<boolean> {
    const blocked = await this.redis.get(`blocked:${ip}`);
    return blocked === '1';
  }

  // Get concurrent connections for an IP
  private async getConcurrentConnections(ip: string): Promise<number> {
    const key = `connections:${ip}`;
    const count = await this.redis.incr(key);

    // Reset counter after 1 minute
    await this.redis.pexpire(key, 60000);

    return count;
  }

  // Generate rate limit key from request
  private generateKey(request: Request): string {
    const ip = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const method = request.method;
    const url = new URL(request.url).pathname;

    // Create a hash of the key components
    const keyString = `${ip}:${method}:${url}:${userAgent.substring(0, 50)}`;
    return Buffer.from(keyString).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }

  // Get client IP from request
  private getClientIP(request: Request): string {
    // Check various headers for the real IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwardedFor) return forwardedFor.split(',')[0].trim();

    // Fallback - this won't work in production but for development
    return '127.0.0.1';
  }

  // Get request body for pattern matching (limited to prevent memory issues)
  private async getRequestBody(request: Request): Promise<string> {
    try {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return '';
      }

      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        return '';
      }

      const body = await request.text();
      return body.substring(0, 1000); // Limit to first 1000 characters
    } catch (error) {
      return '';
    }
  }

  // Clean up expired rate limit keys
  async cleanup(): Promise<void> {
    try {
      // This is handled automatically by Redis TTL, but we can add custom cleanup logic here
      const keys = await this.redis.keys('ratelimit:*');
      // Additional cleanup logic can be added here
    } catch (error) {
      logger.error('Rate limit cleanup failed:', error);
    }
  }

  // Get rate limit statistics
  async getStats(identifier?: string): Promise<{
    configs: number;
    activeKeys: number;
    blockedIPs: number;
  }> {
    try {
      let activeKeys = 0;
      let blockedIPs = 0;

      if (identifier) {
        const config = this.configs.get(identifier);
        if (config) {
          // Count keys for specific config
          const pattern = `${identifier}:*`;
          const keys = await this.redis.keys(pattern);
          activeKeys = keys.length;
        }
      } else {
        // Count all rate limit keys
        const keys = await this.redis.keys('ratelimit:*');
        activeKeys = keys.length;
      }

      // Count blocked IPs
      const blockedKeys = await this.redis.keys('blocked:*');
      blockedIPs = blockedKeys.length;

      return {
        configs: this.configs.size,
        activeKeys,
        blockedIPs,
      };
    } catch (error) {
      logger.error('Failed to get rate limit stats:', error);
      return {
        configs: this.configs.size,
        activeKeys: 0,
        blockedIPs: 0,
      };
    }
  }

  // Update DDoS protection configuration
  updateDDoSConfig(config: Partial<DDoSProtectionConfig>): void {
    this.ddosConfig = { ...this.ddosConfig, ...config };
    logger.info('DDoS protection configuration updated');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    await this.redis.quit();
    logger.info('Rate limit service shut down');
  }
}

export const advancedRateLimitService = AdvancedRateLimitService.getInstance();
export default advancedRateLimitService;