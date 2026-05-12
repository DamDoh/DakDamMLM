declare class CacheService {
    private client;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    invalidatePattern(pattern: string): Promise<void>;
    getCommissionCacheKey(commissionId: string): string;
    getUserCommissionsCacheKey(userId: string, page?: number, limit?: number): string;
    getCommissionRulesCacheKey(): string;
    getUserPayoutsCacheKey(userId: string, page?: number, limit?: number): string;
    getCommissionStatsCacheKey(userId: string, period: string): string;
    getCachedCommission(commissionId: string): Promise<any>;
    setCachedCommission(commissionId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedUserCommissions(userId: string, page?: number, limit?: number): Promise<any>;
    setCachedUserCommissions(userId: string, data: any, page?: number, limit?: number, ttlSeconds?: number): Promise<void>;
    getCachedCommissionRules(): Promise<any>;
    setCachedCommissionRules(data: any, ttlSeconds?: number): Promise<void>;
    getCachedUserPayouts(userId: string, page?: number, limit?: number): Promise<any>;
    setCachedUserPayouts(userId: string, data: any, page?: number, limit?: number, ttlSeconds?: number): Promise<void>;
    getCachedCommissionStats(userId: string, period: string): Promise<any>;
    setCachedCommissionStats(userId: string, period: string, data: any, ttlSeconds?: number): Promise<void>;
    invalidateCommissionCache(commissionId: string): Promise<void>;
    invalidateUserCommissionsCache(userId: string): Promise<void>;
    invalidateCommissionRulesCache(): Promise<void>;
    invalidateUserPayoutsCache(userId: string): Promise<void>;
    invalidateCommissionStatsCache(userId: string): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        latency?: number;
    }>;
}
export declare const cacheService: CacheService;
export default cacheService;
//# sourceMappingURL=cache.d.ts.map