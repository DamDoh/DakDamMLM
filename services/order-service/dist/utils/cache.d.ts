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
    getOrderCacheKey(orderId: string): string;
    getUserOrdersCacheKey(userId: string, page?: number, limit?: number): string;
    getProductCacheKey(productId: string): string;
    getCartCacheKey(userId: string): string;
    getInventoryCacheKey(productId: string): string;
    getCachedOrder(orderId: string): Promise<any>;
    setCachedOrder(orderId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedUserOrders(userId: string, page?: number, limit?: number): Promise<any>;
    setCachedUserOrders(userId: string, data: any, page?: number, limit?: number, ttlSeconds?: number): Promise<void>;
    getCachedProduct(productId: string): Promise<any>;
    setCachedProduct(productId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedCart(userId: string): Promise<any>;
    setCachedCart(userId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedInventory(productId: string): Promise<any>;
    setCachedInventory(productId: string, data: any, ttlSeconds?: number): Promise<void>;
    invalidateOrderCache(orderId: string): Promise<void>;
    invalidateUserOrdersCache(userId: string): Promise<void>;
    invalidateProductCache(productId: string): Promise<void>;
    invalidateCartCache(userId: string): Promise<void>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        latency?: number;
    }>;
}
export declare const cacheService: CacheService;
export default cacheService;
//# sourceMappingURL=cache.d.ts.map