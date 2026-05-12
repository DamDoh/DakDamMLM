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
    getNotificationCacheKey(notificationId: string): string;
    getUserNotificationsCacheKey(userId: string, page?: number, limit?: number): string;
    getTemplateCacheKey(templateId: string): string;
    getUserPreferencesCacheKey(userId: string): string;
    getCachedNotification(notificationId: string): Promise<any>;
    setCachedNotification(notificationId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedUserNotifications(userId: string, page?: number, limit?: number): Promise<any>;
    setCachedUserNotifications(userId: string, data: any, page?: number, limit?: number, ttlSeconds?: number): Promise<void>;
    getCachedTemplate(templateId: string): Promise<any>;
    setCachedTemplate(templateId: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedUserPreferences(userId: string): Promise<any>;
    setCachedUserPreferences(userId: string, data: any, ttlSeconds?: number): Promise<void>;
    invalidateNotificationCache(notificationId: string): Promise<void>;
    invalidateUserNotificationsCache(userId: string): Promise<void>;
    invalidateTemplateCache(templateId: string): Promise<void>;
    invalidateUserPreferencesCache(userId: string): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        latency?: number;
    }>;
}
export declare const cacheService: CacheService;
export default cacheService;
//# sourceMappingURL=cache.d.ts.map