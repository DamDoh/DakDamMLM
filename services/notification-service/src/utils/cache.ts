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

  // Notification-specific cache methods
  getNotificationCacheKey(notificationId: string): string {
    return `notification:${notificationId}`;
  }

  getUserNotificationsCacheKey(userId: string, page?: number, limit?: number): string {
    return page && limit ? `user_notifications:${userId}:${page}:${limit}` : `user_notifications:${userId}`;
  }

  getTemplateCacheKey(templateId: string): string {
    return `template:${templateId}`;
  }

  getUserPreferencesCacheKey(userId: string): string {
    return `user_preferences:${userId}`;
  }

  async getCachedNotification(notificationId: string): Promise<any> {
    const key = this.getNotificationCacheKey(notificationId);
    return this.get(key);
  }

  async setCachedNotification(notificationId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getNotificationCacheKey(notificationId);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedUserNotifications(userId: string, page?: number, limit?: number): Promise<any> {
    const key = this.getUserNotificationsCacheKey(userId, page, limit);
    return this.get(key);
  }

  async setCachedUserNotifications(userId: string, data: any, page?: number, limit?: number, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getUserNotificationsCacheKey(userId, page, limit);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedTemplate(templateId: string): Promise<any> {
    const key = this.getTemplateCacheKey(templateId);
    return this.get(key);
  }

  async setCachedTemplate(templateId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getTemplateCacheKey(templateId);
    await this.set(key, data, ttlSeconds);
  }

  async getCachedUserPreferences(userId: string): Promise<any> {
    const key = this.getUserPreferencesCacheKey(userId);
    return this.get(key);
  }

  async setCachedUserPreferences(userId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getUserPreferencesCacheKey(userId);
    await this.set(key, data, ttlSeconds);
  }

  // Invalidate notification-related caches
  async invalidateNotificationCache(notificationId: string): Promise<void> {
    await this.invalidatePattern(`notification:${notificationId}`);
  }

  async invalidateUserNotificationsCache(userId: string): Promise<void> {
    await this.invalidatePattern(`user_notifications:${userId}:*`);
  }

  async invalidateTemplateCache(templateId: string): Promise<void> {
    await this.invalidatePattern(`template:${templateId}`);
  }

  async invalidateUserPreferencesCache(userId: string): Promise<void> {
    await this.invalidatePattern(`user_preferences:${userId}`);
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