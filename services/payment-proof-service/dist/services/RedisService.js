"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = require("../index");
const database_1 = require("../config/database");
class RedisService {
    constructor() {
        this.isConnected = false;
        this.client = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            reconnectOnError: (err) => {
                index_1.logger.error('Redis reconnection error', { error: err.message });
                return err.message.includes('READONLY');
            }
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.client.on('connect', () => {
            this.isConnected = true;
            index_1.logger.info('Redis connected successfully');
        });
        this.client.on('error', (error) => {
            this.isConnected = false;
            index_1.logger.error('Redis connection error', { error: error.message });
        });
        this.client.on('ready', () => {
            index_1.logger.info('Redis is ready to receive commands');
        });
        this.client.on('close', () => {
            this.isConnected = false;
            index_1.logger.warn('Redis connection closed');
        });
    }
    async connect() {
        if (!this.isConnected) {
            await this.client.connect();
        }
    }
    async disconnect() {
        if (this.isConnected) {
            await this.client.quit();
        }
    }
    isHealthy() {
        return this.isConnected && this.client.status === 'ready';
    }
    // Generic cache operations
    async get(key) {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            index_1.logger.error('Redis GET error', { key, error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            const serializedValue = JSON.stringify(value);
            if (ttl) {
                await this.client.setex(key, ttl, serializedValue);
            }
            else {
                await this.client.set(key, serializedValue);
            }
            return true;
        }
        catch (error) {
            index_1.logger.error('Redis SET error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async delete(key) {
        try {
            await this.client.del(key);
            return true;
        }
        catch (error) {
            index_1.logger.error('Redis DELETE error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            index_1.logger.error('Redis EXISTS error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    // User permissions caching
    async getUserPermissions(userId) {
        const cacheKey = `user:permissions:${userId}`;
        const cached = await this.get(cacheKey);
        if (cached) {
            index_1.logger.debug('User permissions cache hit', { userId });
            return cached;
        }
        // Fetch from database
        const permissions = await this.fetchUserPermissionsFromDB(userId);
        // Cache for 5 minutes
        if (permissions) {
            await this.set(cacheKey, permissions, 300);
            index_1.logger.debug('User permissions cached', { userId });
        }
        return permissions;
    }
    // Proof metadata caching
    async getProofMetadata(proofId) {
        const cacheKey = `proof:metadata:${proofId}`;
        const cached = await this.get(cacheKey);
        if (cached) {
            return cached;
        }
        const metadata = await database_1.prisma.paymentProof.findUnique({
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
    async checkRateLimit(identifier, action, limit, windowMs) {
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
        }
        catch (error) {
            index_1.logger.error('Rate limit check error', { identifier, action, error: error instanceof Error ? error.message : String(error) });
            // Allow request on error to avoid blocking legitimate traffic
            return { allowed: true, remaining: limit - 1, resetTime: Date.now() + windowMs };
        }
    }
    // Fraud detection caching
    async getFraudCheckResult(fileHash) {
        const cacheKey = `fraud:check:${fileHash}`;
        return await this.get(cacheKey);
    }
    async setFraudCheckResult(fileHash, result, ttl = 3600) {
        const cacheKey = `fraud:check:${fileHash}`;
        await this.set(cacheKey, result, ttl);
    }
    // Cache invalidation
    async invalidateUserCache(userId) {
        try {
            const pattern = `user:*${userId}*`;
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
                index_1.logger.debug('User cache invalidated', { userId, keysInvalidated: keys.length });
            }
        }
        catch (error) {
            index_1.logger.error('Error invalidating user cache', { userId, error: error instanceof Error ? error.message : String(error) });
        }
    }
    async invalidateProofCache(proofId) {
        try {
            const pattern = `proof:*${proofId}*`;
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
                index_1.logger.debug('Proof cache invalidated', { proofId, keysInvalidated: keys.length });
            }
        }
        catch (error) {
            index_1.logger.error('Error invalidating proof cache', { proofId, error: error instanceof Error ? error.message : String(error) });
        }
    }
    // Batch operations
    async getMultiple(keys) {
        try {
            const values = await this.client.mget(...keys);
            return values.map(value => value ? JSON.parse(value) : null);
        }
        catch (error) {
            index_1.logger.error('Redis MGET error', { keys, error: error instanceof Error ? error.message : String(error) });
            return new Array(keys.length).fill(null);
        }
    }
    async setMultiple(data, ttl) {
        try {
            const pipeline = this.client.pipeline();
            for (const [key, value] of Object.entries(data)) {
                const serializedValue = JSON.stringify(value);
                if (ttl) {
                    pipeline.setex(key, ttl, serializedValue);
                }
                else {
                    pipeline.set(key, serializedValue);
                }
            }
            await pipeline.exec();
            return true;
        }
        catch (error) {
            index_1.logger.error('Redis batch SET error', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    // Cache statistics
    async getCacheStats() {
        try {
            const info = await this.client.info('stats');
            const dbSize = await this.client.dbsize();
            return {
                connected: this.isConnected,
                dbSize,
                info: this.parseRedisInfo(info)
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            index_1.logger.error('Error getting cache stats', { error: errorMessage });
            return { connected: false, error: errorMessage };
        }
    }
    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const stats = {};
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                stats[key] = value;
            }
        }
        return stats;
    }
    async fetchUserPermissionsFromDB(userId) {
        try {
            const user = await database_1.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    isAdmin: true,
                    accountType: true,
                    sponsorId: true
                }
            });
            if (!user)
                return null;
            const role = user.isAdmin ? 'admin' : (user.accountType || 'buyer');
            const sponsorId = user.sponsorId;
            return {
                role,
                uplineId: sponsorId,
                canUploadProofs: ['buyer', 'upline', 'admin'].includes(role),
                canReviewProofs: ['upline', 'admin'].includes(role),
                canManageUsers: role === 'admin',
                canViewAuditLogs: ['admin', 'auditor'].includes(role)
            };
        }
        catch (error) {
            index_1.logger.error('Error fetching user permissions from DB', { userId, error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    // Health check
    async ping() {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch {
            return false;
        }
    }
}
exports.RedisService = RedisService;
// Global Redis service instance
exports.redisService = new RedisService();
//# sourceMappingURL=RedisService.js.map