export interface CacheConfig {
    ttl: number;
    keyPrefix?: string;
}
export declare class RedisService {
    private client;
    private isConnected;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isHealthy(): boolean;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl?: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    getUserPermissions(userId: string): Promise<any>;
    getProofMetadata(proofId: string): Promise<any>;
    checkRateLimit(identifier: string, action: string, limit: number, windowMs: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    getFraudCheckResult(fileHash: string): Promise<any>;
    setFraudCheckResult(fileHash: string, result: any, ttl?: number): Promise<void>;
    invalidateUserCache(userId: string): Promise<void>;
    invalidateProofCache(proofId: string): Promise<void>;
    getMultiple<T>(keys: string[]): Promise<(T | null)[]>;
    setMultiple(data: Record<string, any>, ttl?: number): Promise<boolean>;
    getCacheStats(): Promise<any>;
    private parseRedisInfo;
    private fetchUserPermissionsFromDB;
    ping(): Promise<boolean>;
}
export declare const redisService: RedisService;
//# sourceMappingURL=RedisService.d.ts.map