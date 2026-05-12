import Redis from 'ioredis';
import { logger } from '../index';
import { prisma } from '../config/database';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix?: string;
}

export class RedisService {
  private client: Redis;
  private isConnected = false;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      reconnectOnError: (err: Error) => {
        logger.error('Redis reconnection error', { error: err.message });
        return err.message.includes('READONLY');
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis connection error', { error: error.message });
    });

    this.client.on('ready', () => {
      logger.info('Redis is ready to receive commands');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  // Generic cache operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis GET error', { key, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DELETE error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // User permissions caching
  async getUserPermissions(userId: string): Promise<any> {
    const cacheKey = `user:permissions:${userId}`;
    const cached = await this.get(cacheKey);

    if (cached) {
      logger.debug('User permissions cache hit', { userId });
      return cached;
    }

    // Fetch from database
    const permissions = await this.fetchUserPermissionsFromDB(userId);

    // Cache for 5 minutes
    if (permissions) {
      await this.set(cacheKey, permissions, 300);
      logger.debug('User permissions cached', { userId });
    }

    return permissions;
  }

  // Proof metadata caching
  async getProofMetadata(proofId: string): Promise<any> {
    const cacheKey = `proof:metadata:${proofId}`;
    const cached = await this.get(cacheKey);

    if (cached) {
      return cached;
    }

    const metadata = await (prisma as any).paymentProof.findUnique({
      where: { id: proofId },
      select: {
        id: true,
        status: true,
        reviewedById: true,
        reviewedAt: true,
        createdAt: true,
        userId: true
      }
    });

    if (metadata) {
      await this.set(cacheKey, metadata, 600); // 10 minutes
    }

    return metadata;
  }

  // Rate limiting with Redis
  async checkRateLimit(
    identifier: string,
    action: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `ratelimit:${action}:${identifier}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;

      // Use Redis sorted set to track requests
      const member = `${now}:${Math.random()}`;

      // Add current request
      await this.client.zadd(key, now, member);

      // Remove old requests outside the window
      await this.client.zremrangebyscore(key, 0, windowStart);

      // Count remaining requests in window
      const requestCount = await this.client.zcard(key);

      // Set expiry on the key
      await this.client.pexpire(key, windowMs);

      const allowed = requestCount <= limit;
      const remaining = Math.max(0, limit - requestCount);
      const resetTime = windowStart + windowMs;

      return { allowed, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limit check error', { identifier, action, error: error instanceof Error ? error.message : String(error) });
      // Allow request on error to avoid blocking legitimate traffic
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + windowMs };
    }
  }

  // Fraud detection caching
  async getFraudCheckResult(fileHash: string): Promise<any> {
    const cacheKey = `fraud:check:${fileHash}`;
    return await this.get(cacheKey);
  }

  async setFraudCheckResult(fileHash: string, result: any, ttl = 3600): Promise<void> {
    const cacheKey = `fraud:check:${fileHash}`;
    await this.set(cacheKey, result, ttl);
  }

  // Cache invalidation
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `user:*${userId}*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.debug('User cache invalidated', { userId, keysInvalidated: keys.length });
      }
    } catch (error) {
      logger.error('Error invalidating user cache', { userId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async invalidateProofCache(proofId: string): Promise<void> {
    try {
      const pattern = `proof:*${proofId}*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.debug('Proof cache invalidated', { proofId, keysInvalidated: keys.length });
      }
    } catch (error) {
      logger.error('Error invalidating proof cache', { proofId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Batch operations
  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(...keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Redis MGET error', { keys, error: error instanceof Error ? error.message : String(error) });
      return new Array(keys.length).fill(null);
    }
  }

  async setMultiple(data: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      const pipeline = this.client.pipeline();

      for (const [key, value] of Object.entries(data)) {
        const serializedValue = JSON.stringify(value);
        if (ttl) {
          pipeline.setex(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Redis batch SET error', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Cache statistics
  async getCacheStats(): Promise<any> {
    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();

      return {
        connected: this.isConnected,
        dbSize,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting cache stats', { error: errorMessage });
      return { connected: false, error: errorMessage };
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const lines = info.split('\r\n');
    const stats: Record<string, any> = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    }

    return stats;
  }

  private async fetchUserPermissionsFromDB(userId: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isAdmin: true,
          accountType: true,
          sponsorId: true
        }
      });

      if (!user) return null;

      const role = user.isAdmin ? 'admin' : (user.accountType || 'buyer');
      const sponsorId = (user as any).sponsorId;

      return {
        role,
        uplineId: sponsorId,
        canUploadProofs: ['buyer', 'upline', 'admin'].includes(role),
        canReviewProofs: ['upline', 'admin'].includes(role),
        canManageUsers: role === 'admin',
        canViewAuditLogs: ['admin', 'auditor'].includes(role)
      };
    } catch (error) {
      logger.error('Error fetching user permissions from DB', { userId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Global Redis service instance
export const redisService = new RedisService();