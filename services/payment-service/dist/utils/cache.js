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
    // Payment-specific cache methods
    getTransactionCacheKey(transactionId) {
        return `transaction:${transactionId}`;
    }
    getUserTransactionsCacheKey(userId, page, limit) {
        return page && limit ? `user_transactions:${userId}:${page}:${limit}` : `user_transactions:${userId}`;
    }
    getWalletCacheKey(userId) {
        return `wallet:${userId}`;
    }
    getPayoutCacheKey(payoutId) {
        return `payout:${payoutId}`;
    }
    async getCachedTransaction(transactionId) {
        const key = this.getTransactionCacheKey(transactionId);
        return this.get(key);
    }
    async setCachedTransaction(transactionId, data, ttlSeconds = 3600) {
        const key = this.getTransactionCacheKey(transactionId);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedUserTransactions(userId, page, limit) {
        const key = this.getUserTransactionsCacheKey(userId, page, limit);
        return this.get(key);
    }
    async setCachedUserTransactions(userId, data, page, limit, ttlSeconds = 1800) {
        const key = this.getUserTransactionsCacheKey(userId, page, limit);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedWallet(userId) {
        const key = this.getWalletCacheKey(userId);
        return this.get(key);
    }
    async setCachedWallet(userId, data, ttlSeconds = 300) {
        const key = this.getWalletCacheKey(userId);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedPayout(payoutId) {
        const key = this.getPayoutCacheKey(payoutId);
        return this.get(key);
    }
    async setCachedPayout(payoutId, data, ttlSeconds = 3600) {
        const key = this.getPayoutCacheKey(payoutId);
        await this.set(key, data, ttlSeconds);
    }
    // Invalidate payment-related caches
    async invalidateTransactionCache(transactionId) {
        await this.invalidatePattern(`transaction:${transactionId}`);
    }
    async invalidateUserTransactionsCache(userId) {
        await this.invalidatePattern(`user_transactions:${userId}:*`);
    }
    async invalidateWalletCache(userId) {
        await this.invalidatePattern(`wallet:${userId}`);
    }
    async invalidatePayoutCache(payoutId) {
        await this.invalidatePattern(`payout:${payoutId}`);
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