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

  // Payment-specific cache methods
  getTransactionCacheKey(transactionId: string): string {
    return `transaction:${transactionId}`;
  }

  getUserTransactionsCacheKey(userId: string, page?: number, limit?: number): string {
    return page && limit ? `user_transactions:${userId}:${page}:${limit}` : `user_transactions:${userId}`;
  }

  getWalletCacheKey(userId: string): string {
    return `wallet:${userId}`;
  }

  getPayoutCacheKey(payoutId: string): string {
    return `payout:${payoutId}`;
  }

  async getCachedTransaction(transactionId: string): Promise<any> {
    const key = this.getTransactionCacheKey(transactionId);
    return this.get(key);
  }

  async setCachedTransaction(transactionId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getTransactionCacheKey(transactionId);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedUserTransactions(userId: string, page?: number, limit?: number): Promise<any> {
    const key = this.getUserTransactionsCacheKey(userId, page, limit);
    return this.get(key);
  }

  async setCachedUserTransactions(userId: string, data: any, page?: number, limit?: number, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getUserTransactionsCacheKey(userId, page, limit);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedWallet(userId: string): Promise<any> {
    const key = this.getWalletCacheKey(userId);
    return this.get(key);
  }

  async setCachedWallet(userId: string, data: any, ttlSeconds: number = 300): Promise<void> {
    const key = this.getWalletCacheKey(userId);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedPayout(payoutId: string): Promise<any> {
    const key = this.getPayoutCacheKey(payoutId);
    return this.get(key);
  }

  async setCachedPayout(payoutId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getPayoutCacheKey(payoutId);
    await this.set(key, data, ttlSeconds);
  }

  // Invalidate payment-related caches
  async invalidateTransactionCache(transactionId: string): Promise<void> {
    await this.invalidatePattern(`transaction:${transactionId}`);
  }

  async invalidateUserTransactionsCache(userId: string): Promise<void> {
    await this.invalidatePattern(`user_transactions:${userId}:*`);
  }

  async invalidateWalletCache(userId: string): Promise<void> {
    await this.invalidatePattern(`wallet:${userId}`);
  }

  async invalidatePayoutCache(payoutId: string): Promise<void> {
    await this.invalidatePattern(`payout:${payoutId}`);
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