"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const redis_1 = require("redis");
const logger_1 = require("./logger");
class CacheService {
    constructor() {
        this.isConnected = false;
        this.client = (0, redis_1.createClient)({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                connectTimeout: 60000,
            },
        });
        this.client.on('error', (err) => {
            logger_1.logger.error('Redis Client Error', { error: err.message });
            this.isConnected = false;
        });
        this.client.on('connect', () => {
            logger_1.logger.info('Redis Client Connected');
            this.isConnected = true;
        });
        this.client.on('disconnect', () => {
            logger_1.logger.warn('Redis Client Disconnected');
            this.isConnected = false;
        });
    }
    async connect() {
        if (!this.isConnected) {
            try {
                await this.client.connect();
            }
            catch (error) {
                logger_1.logger.error('Failed to connect to Redis', { error: error.message });
                throw error;
            }
        }
    }
    async disconnect() {
        if (this.isConnected) {
            await this.client.disconnect();
        }
    }
    async get(key) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            const value = await this.client.get(key);
            if (value) {
                logger_1.logger.debug('Cache hit', { key });
                return JSON.parse(value);
            }
            logger_1.logger.debug('Cache miss', { key });
            return null;
        }
        catch (error) {
            logger_1.logger.error('Cache get error', { key, error: error.message });
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            const serializedValue = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, serializedValue);
                logger_1.logger.debug('Cache set with TTL', { key, ttlSeconds });
            }
            else {
                await this.client.set(key, serializedValue);
                logger_1.logger.debug('Cache set', { key });
            }
        }
        catch (error) {
            logger_1.logger.error('Cache set error', { key, error: error.message });
        }
    }
    async del(key) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            await this.client.del(key);
            logger_1.logger.debug('Cache deleted', { key });
        }
        catch (error) {
            logger_1.logger.error('Cache delete error', { key, error: error.message });
        }
    }
    async exists(key) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Cache exists error', { key, error: error.message });
            return false;
        }
    }
    async invalidatePattern(pattern) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
                logger_1.logger.info('Cache pattern invalidated', { pattern, keysDeleted: keys.length });
            }
        }
        catch (error) {
            logger_1.logger.error('Cache pattern invalidation error', { pattern, error: error.message });
        }
    }
    // Order-specific cache methods
    getOrderCacheKey(orderId) {
        return `order:${orderId}`;
    }
    getUserOrdersCacheKey(userId, page, limit) {
        return page && limit ? `user_orders:${userId}:${page}:${limit}` : `user_orders:${userId}`;
    }
    getProductCacheKey(productId) {
        return `product:${productId}`;
    }
    getCartCacheKey(userId) {
        return `cart:${userId}`;
    }
    getInventoryCacheKey(productId) {
        return `inventory:${productId}`;
    }
    async getCachedOrder(orderId) {
        const key = this.getOrderCacheKey(orderId);
        return this.get(key);
    }
    async setCachedOrder(orderId, data, ttlSeconds = 3600) {
        const key = this.getOrderCacheKey(orderId);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedUserOrders(userId, page, limit) {
        const key = this.getUserOrdersCacheKey(userId, page, limit);
        return this.get(key);
    }
    async setCachedUserOrders(userId, data, page, limit, ttlSeconds = 1800) {
        const key = this.getUserOrdersCacheKey(userId, page, limit);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedProduct(productId) {
        const key = this.getProductCacheKey(productId);
        return this.get(key);
    }
    async setCachedProduct(productId, data, ttlSeconds = 3600) {
        const key = this.getProductCacheKey(productId);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedCart(userId) {
        const key = this.getCartCacheKey(userId);
        return this.get(key);
    }
    async setCachedCart(userId, data, ttlSeconds = 1800) {
        const key = this.getCartCacheKey(userId);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedInventory(productId) {
        const key = this.getInventoryCacheKey(productId);
        return this.get(key);
    }
    async setCachedInventory(productId, data, ttlSeconds = 300) {
        const key = this.getInventoryCacheKey(productId);
        await this.set(key, data, ttlSeconds);
    }
    // Invalidate order-related caches
    async invalidateOrderCache(orderId) {
        await this.invalidatePattern(`order:${orderId}`);
    }
    async invalidateUserOrdersCache(userId) {
        await this.invalidatePattern(`user_orders:${userId}:*`);
    }
    async invalidateProductCache(productId) {
        await this.invalidatePattern(`product:${productId}`);
        await this.invalidatePattern(`inventory:${productId}`);
    }
    async invalidateCartCache(userId) {
        await this.invalidatePattern(`cart:${userId}`);
    }
    // Health check
    async healthCheck() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            return { status: 'healthy', latency };
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
}
// Export singleton instance
exports.cacheService = new CacheService();
exports.default = exports.cacheService;
//# sourceMappingURL=cache.js.map