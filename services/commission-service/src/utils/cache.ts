import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 60000,
      },
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis', { error: (error as Error).message });
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const value = await this.client.get(key);
      if (value) {
        logger.debug('Cache hit', { key });
        return JSON.parse(value);
      }

      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: (error as Error).message });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
        logger.debug('Cache set with TTL', { key, ttlSeconds });
      } else {
        await this.client.set(key, serializedValue);
        logger.debug('Cache set', { key });
      }
    } catch (error) {
      logger.error('Cache set error', { key, error: (error as Error).message });
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.client.del(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error: (error as Error).message });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: (error as Error).message });
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info('Cache pattern invalidated', { pattern, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error: (error as Error).message });
    }
  }

  // Commission-specific cache methods
  getCommissionCacheKey(commissionId: string): string {
    return `commission:${commissionId}`;
  }

  getUserCommissionsCacheKey(userId: string, page?: number, limit?: number): string {
    return page && limit ? `user_commissions:${userId}:${page}:${limit}` : `user_commissions:${userId}`;
  }

  getCommissionRulesCacheKey(): string {
    return 'commission_rules';
  }

  getUserPayoutsCacheKey(userId: string, page?: number, limit?: number): string {
    return page && limit ? `user_payouts:${userId}:${page}:${limit}` : `user_payouts:${userId}`;
  }

  getCommissionStatsCacheKey(userId: string, period: string): string {
    return `commission_stats:${userId}:${period}`;
  }

  async getCachedCommission(commissionId: string): Promise<any> {
    const key = this.getCommissionCacheKey(commissionId);
    return this.get(key);
  }

  async setCachedCommission(commissionId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getCommissionCacheKey(commissionId);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedUserCommissions(userId: string, page?: number, limit?: number): Promise<any> {
    const key = this.getUserCommissionsCacheKey(userId, page, limit);
    return this.get(key);
  }

  async setCachedUserCommissions(userId: string, data: any, page?: number, limit?: number, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getUserCommissionsCacheKey(userId, page, limit);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedCommissionRules(): Promise<any> {
    const key = this.getCommissionRulesCacheKey();
    return this.get(key);
  }

  async setCachedCommissionRules(data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getCommissionRulesCacheKey();
    await this.set(key, data, ttlSeconds);
  }

  async getCachedUserPayouts(userId: string, page?: number, limit?: number): Promise<any> {
    const key = this.getUserPayoutsCacheKey(userId, page, limit);
    return this.get(key);
  }

  async setCachedUserPayouts(userId: string, data: any, page?: number, limit?: number, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getUserPayoutsCacheKey(userId, page, limit);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedCommissionStats(userId: string, period: string): Promise<any> {
    const key = this.getCommissionStatsCacheKey(userId, period);
    return this.get(key);
  }

  async setCachedCommissionStats(userId: string, period: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getCommissionStatsCacheKey(userId, period);
    await this.set(key, data, ttlSeconds);
  }

  // Invalidate commission-related caches
  async invalidateCommissionCache(commissionId: string): Promise<void> {
    await this.invalidatePattern(`commission:${commissionId}`);
  }

  async invalidateUserCommissionsCache(userId: string): Promise<void> {
    await this.invalidatePattern(`user_commissions:${userId}:*`);
  }

  async invalidateCommissionRulesCache(): Promise<void> {
    await this.invalidatePattern('commission_rules');
  }

  async invalidateUserPayoutsCache(userId: string): Promise<void> {
    await this.invalidatePattern(`user_payouts:${userId}:*`);
  }

  async invalidateCommissionStatsCache(userId: string): Promise<void> {
    await this.invalidatePattern(`commission_stats:${userId}:*`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;