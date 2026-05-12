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
    // Commission-specific cache methods
    getCommissionCacheKey(commissionId) {
        return `commission:${commissionId}`;
    }
    getUserCommissionsCacheKey(userId, page, limit) {
        return page && limit ? `user_commissions:${userId}:${page}:${limit}` : `user_commissions:${userId}`;
    }
    getCommissionRulesCacheKey() {
        return 'commission_rules';
    }
    getUserPayoutsCacheKey(userId, page, limit) {
        return page && limit ? `user_payouts:${userId}:${page}:${limit}` : `user_payouts:${userId}`;
    }
    getCommissionStatsCacheKey(userId, period) {
        return `commission_stats:${userId}:${period}`;
    }
    async getCachedCommission(commissionId) {
        const key = this.getCommissionCacheKey(commissionId);
        return this.get(key);
    }
    async setCachedCommission(commissionId, data, ttlSeconds = 3600) {
        const key = this.getCommissionCacheKey(commissionId);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedUserCommissions(userId, page, limit) {
        const key = this.getUserCommissionsCacheKey(userId, page, limit);
        return this.get(key);
    }
    async setCachedUserCommissions(userId, data, page, limit, ttlSeconds = 1800) {
        const key = this.getUserCommissionsCacheKey(userId, page, limit);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedCommissionRules() {
        const key = this.getCommissionRulesCacheKey();
        return this.get(key);
    }
    async setCachedCommissionRules(data, ttlSeconds = 3600) {
        const key = this.getCommissionRulesCacheKey();
        await this.set(key, data, ttlSeconds);
    }
    async getCachedUserPayouts(userId, page, limit) {
        const key = this.getUserPayoutsCacheKey(userId, page, limit);
        return this.get(key);
    }
    async setCachedUserPayouts(userId, data, page, limit, ttlSeconds = 1800) {
        const key = this.getUserPayoutsCacheKey(userId, page, limit);
        await this.set(key, data, ttlSeconds);
    }
    async getCachedCommissionStats(userId, period) {
        const key = this.getCommissionStatsCacheKey(userId, period);
        return this.get(key);
    }
    async setCachedCommissionStats(userId, period, data, ttlSeconds = 3600) {
        const key = this.getCommissionStatsCacheKey(userId, period);
        await this.set(key, data, ttlSeconds);
    }
    // Invalidate commission-related caches
    async invalidateCommissionCache(commissionId) {
        await this.invalidatePattern(`commission:${commissionId}`);
    }
    async invalidateUserCommissionsCache(userId) {
        await this.invalidatePattern(`user_commissions:${userId}:*`);
    }
    async invalidateCommissionRulesCache() {
        await this.invalidatePattern('commission_rules');
    }
    async invalidateUserPayoutsCache(userId) {
        await this.invalidatePattern(`user_payouts:${userId}:*`);
    }
    async invalidateCommissionStatsCache(userId) {
        await this.invalidatePattern(`commission_stats:${userId}:*`);
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