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
    getTransactionCacheKey(transactionId: string): string;
    getUserTransactionsCacheKey(userId: string, page?: number, limit?: number): string;
    getWalletCacheKey(userId: string): string;
    getPayoutCacheKey(payoutId: string): string;
    getCachedTransaction(transactionId: string): Promise<any>;
    setCachedTransaction(transactionId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedUserTransactions(userId: string, page?: number, limit?: number): Promise<any>;
    setCachedUserTransactions(userId: string, data: any, page?: number, limit?: number, ttlSeconds?: number): Promise<void>;
    getCachedWallet(userId: string): Promise<any>;
    setCachedWallet(userId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedPayout(payoutId: string): Promise<any>;
    setCachedPayout(payoutId: string, data: any, ttlSeconds?: number): Promise<void>;
    invalidateTransactionCache(transactionId: string): Promise<void>;
    invalidateUserTransactionsCache(userId: string): Promise<void>;
    invalidateWalletCache(userId: string): Promise<void>;
    invalidatePayoutCache(payoutId: string): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        latency?: number;
    }>;
}
export declare const cacheService: CacheService;
export default cacheService;
//# sourceMappingURL=cache.d.ts.map