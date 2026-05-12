interface BulkUpdateData {
    userId: string;
    preferences: Partial<any>;
}
export declare class PreferenceService {
    getUserPreferences(userId: string): Promise<any>;
    createUserPreferences(userId: string, preferencesData: any): Promise<any>;
    updateUserPreferences(userId: string, updates: any): Promise<any>;
    bulkUpdatePreferences(updates: BulkUpdateData[]): Promise<({
        userId: string;
        success: boolean;
        data: any;
        error?: undefined;
    } | {
        userId: string;
        success: boolean;
        error: string;
        data?: undefined;
    })[]>;
    getPreferencesAnalytics(): Promise<{
        totalUsersWithPreferences: any;
        channelPreferences: {
            email: any;
            sms: any;
            push: any;
        };
        categoryPreferences: {
            transactionalEmails: any;
            marketingEmails: any;
            commissionAlerts: any;
            orderUpdates: any;
            securityAlerts: any;
        };
        engagementRates: {
            email: number;
            sms: number;
            push: number;
        };
        mostPopularChannel: string;
        leastPopularChannel: string;
    }>;
    deleteUserPreferences(userId: string): Promise<void>;
    isChannelEnabled(userId: string, channel: string): Promise<boolean>;
    isCategoryEnabled(userId: string, category: string): Promise<boolean>;
    isQuietHours(userId: string): Promise<boolean>;
}
export {};
//# sourceMappingURL=PreferenceService.d.ts.map