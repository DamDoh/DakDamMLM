// Advanced Caching Service
// Multi-level caching with Redis Cluster and CDN optimization

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

export interface CacheConfig {
  ttl: number;
  compression: boolean;
  cluster?: {
    enableClustering: boolean;
    redisNodes: Array<{ host: string; port: number }>;
  };
  cdn?: {
    enabled: boolean;
    provider: 'cloudflare' | 'cloudfront' | 'akamai';
    purgeOnUpdate: boolean;
  };
}

export interface CacheEntry<T = any> {
  data: T;
  metadata: {
    createdAt: Date;
    expiresAt: Date;
    version: string;
    tags: string[];
    size: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memoryUsage: number;
  connectedClients: number;
}

class AdvancedCachingService {
  private static instance: AdvancedCachingService;
  private redis: Redis;
  private localCache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
  };

  private constructor() {
    this.config = {
      ttl: parseInt(process.env.CACHE_TTL || '3600'),
      compression: process.env.CACHE_COMPRESSION === 'true',
      cluster: process.env.REDIS_CLUSTER === 'true' ? {
        enableClustering: true,
        redisNodes: this.parseRedisNodes(),
      } : undefined,
      cdn: process.env.CDN_ENABLED === 'true' ? {
        enabled: true,
        provider: (process.env.CDN_PROVIDER as any) || 'cloudflare',
        purgeOnUpdate: process.env.CDN_PURGE_ON_UPDATE === 'true',
      } : undefined,
    };

    this.initializeRedis();
    this.startCleanupInterval();
  }

  static getInstance(): AdvancedCachingService {
    if (!AdvancedCachingService.instance) {
      AdvancedCachingService.instance = new AdvancedCachingService();
    }
    return AdvancedCachingService.instance;
  }

  // Initialize Redis connection (single or cluster)
  private initializeRedis(): void {
    if (this.config.cluster?.enableClustering) {
      this.redis = new Redis.Cluster(this.config.cluster.redisNodes, {
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          username: process.env.REDIS_USERNAME,
        },
        clusterRetryDelay: 100,
        enableReadyCheck: false,
        maxRedirections: 16,
      });
    } else {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        username: process.env.REDIS_USERNAME,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });
    }

    this.redis.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('ready', () => {
      logger.info('Redis client ready');
    });
  }

  // Set cache entry with advanced options
  async set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      compress?: boolean;
      version?: string;
    } = {}
  ): Promise<void> {
    try {
      const ttl = options.ttl || this.config.ttl;
      const version = options.version || '1.0';
      const tags = options.tags || [];
      const compress = options.compress !== undefined ? options.compress : this.config.compression;

      const entry: CacheEntry<T> = {
        data,
        metadata: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + ttl * 1000),
          version,
          tags,
          size: this.calculateSize(data),
        },
      };

      // Serialize data
      let serializedData = JSON.stringify(entry);
      if (compress) {
        // In production, you would use a compression library like snappy or lz4
        serializedData = `compressed:${Buffer.from(serializedData).toString('base64')}`;
      }

      // Store in Redis
      await this.redis.setex(key, ttl, serializedData);

      // Store in local cache for faster access
      this.localCache.set(key, entry);

      // Update tags index for bulk operations
      if (tags.length > 0) {
        const tagKey = `tags:${key}`;
        await this.redis.sadd(tagKey, ...tags);
        await this.redis.expire(tagKey, ttl);
      }

      this.stats.sets++;

      logger.debug('Cache entry set', { key, ttl, tags: tags.length });
    } catch (error) {
      logger.error('Failed to set cache entry:', error);
      throw error;
    }
  }

  // Get cache entry with fallback
  async get<T>(key: string, fallback?: () => Promise<T>): Promise<T | null> {
    try {
      // Check local cache first
      const localEntry = this.localCache.get(key);
      if (localEntry && localEntry.metadata.expiresAt > new Date()) {
        this.stats.hits++;
        return localEntry.data;
      }

      // Check Redis
      const serializedData = await this.redis.get(key);
      if (!serializedData) {
        this.stats.misses++;
        return fallback ? await fallback() : null;
      }

      // Deserialize data
      let entry: CacheEntry<T>;
      if (serializedData.startsWith('compressed:')) {
        // Decompress in production
        const decompressed = Buffer.from(serializedData.slice(11), 'base64').toString();
        entry = JSON.parse(decompressed);
      } else {
        entry = JSON.parse(serializedData);
      }

      // Check expiration
      if (entry.metadata.expiresAt <= new Date()) {
        await this.delete(key);
        this.stats.misses++;
        return fallback ? await fallback() : null;
      }

      // Update local cache
      this.localCache.set(key, entry);

      this.stats.hits++;
      return entry.data;
    } catch (error) {
      logger.error('Failed to get cache entry:', error);
      this.stats.misses++;
      return fallback ? await fallback() : null;
    }
  }

  // Delete cache entry
  async delete(key: string): Promise<boolean> {
    try {
      // Delete from Redis
      const redisDeleted = await this.redis.del(key);

      // Delete from local cache
      const localDeleted = this.localCache.delete(key);

      // Clean up tags
      const tagKey = `tags:${key}`;
      await this.redis.del(tagKey);

      // Invalidate CDN if configured
      if (this.config.cdn?.purgeOnUpdate) {
        await this.purgeCDN(key);
      }

      this.stats.deletes++;
      const deleted = redisDeleted > 0 || localDeleted;

      if (deleted) {
        logger.debug('Cache entry deleted', { key });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete cache entry:', error);
      return false;
    }
  }

  // Delete by tags (bulk operation)
  async deleteByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;

      for (const tag of tags) {
        // Find all keys with this tag
        const keys = await this.redis.smembers(`tag:${tag}`);

        if (keys.length > 0) {
          // Delete all keys with this tag
          await this.redis.del(...keys);

          // Delete tag index
          await this.redis.del(`tag:${tag}`);

          // Clean up local cache
          keys.forEach(key => this.localCache.delete(key));

          totalDeleted += keys.length;
        }
      }

      this.stats.deletes += totalDeleted;

      logger.info('Cache entries deleted by tags', { tags, deleted: totalDeleted });

      return totalDeleted;
    } catch (error) {
      logger.error('Failed to delete cache by tags:', error);
      return 0;
    }
  }

  // Get or set (cache-aside pattern)
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: {
      ttl?: number;
      tags?: string[];
      compress?: boolean;
    } = {}
  ): Promise<T> {
    let value = await this.get<T>(key);
    if (value === null) {
      value = await factory();
      await this.set(key, value, options);
    }
    return value;
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists > 0;
    } catch (error) {
      logger.error('Failed to check cache existence:', error);
      return false;
    }
  }

  // Get cache statistics
  getStats(): CacheStats {
    return {
      ...this.stats,
      memoryUsage: this.localCache.size * 1024, // Rough estimate
      connectedClients: 0, // Would need Redis INFO command
    };
  }

  // Warm up cache with initial data
  async warmup(data: Record<string, any>): Promise<void> {
    logger.info('Starting cache warmup', { entries: Object.keys(data).length });

    const promises = Object.entries(data).map(([key, value]) =>
      this.set(key, value, { ttl: this.config.ttl })
    );

    await Promise.all(promises);

    logger.info('Cache warmup completed');
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      // Clear Redis (use FLUSHDB carefully in production)
      if (process.env.NODE_ENV === 'development') {
        await this.redis.flushdb();
      }

      // Clear local cache
      this.localCache.clear();

      // Reset stats
      Object.keys(this.stats).forEach(key => {
        this.stats[key as keyof typeof this.stats] = 0;
      });

      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    redis: boolean;
    localCache: boolean;
    stats: CacheStats;
  }> {
    try {
      // Check Redis connectivity
      const redisHealthy = await this.redis.ping() === 'PONG';

      // Check local cache
      const localCacheHealthy = this.localCache.size >= 0;

      const status = redisHealthy && localCacheHealthy ? 'healthy' : 'unhealthy';

      return {
        status,
        redis: redisHealthy,
        localCache: localCacheHealthy,
        stats: this.getStats(),
      };
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return {
        status: 'unhealthy',
        redis: false,
        localCache: false,
        stats: this.getStats(),
      };
    }
  }

  // Private helper methods

  private parseRedisNodes(): Array<{ host: string; port: number }> {
    const nodes = process.env.REDIS_NODES || 'localhost:6379';
    return nodes.split(',').map(node => {
      const [host, port] = node.split(':');
      return {
        host: host.trim(),
        port: parseInt(port.trim()) || 6379,
      };
    });
  }

  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private async purgeCDN(key: string): Promise<void> {
    if (!this.config.cdn?.enabled) return;

    try {
      // In production, this would call the CDN provider's API
      logger.info('CDN cache purge requested', { key, provider: this.config.cdn.provider });
    } catch (error) {
      logger.error('CDN purge failed:', error);
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired local cache entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    let evicted = 0;

    for (const [key, entry] of this.localCache) {
      if (entry.metadata.expiresAt <= now) {
        this.localCache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      logger.debug('Expired cache entries evicted', { count: evicted });
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    await this.redis.quit();
    this.localCache.clear();
    logger.info('Advanced caching service shut down');
  }
}

export const advancedCachingService = AdvancedCachingService.getInstance();
export default advancedCachingService;