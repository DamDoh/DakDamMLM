interface SendNotificationData {
    userId: string;
    type: string;
    channel: string;
    title: string;
    body: string;
    data?: any;
    priority?: string;
    scheduledAt?: Date;
}
interface NotificationQuery {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    channel?: string;
    startDate?: string;
    endDate?: string;
}
interface AnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class NotificationService {
    sendNotification(notificationData: SendNotificationData): Promise<any>;
    sendBulkNotifications(notifications: SendNotificationData[]): Promise<{
        index: number;
        success: boolean;
        data: any;
        error: any;
    }[]>;
    getNotifications(query: NotificationQuery): Promise<{
        notifications: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getNotificationById(notificationId: string): Promise<any>;
    getUserNotifications(userId: string, page?: number, limit?: number, unreadOnly?: boolean): Promise<{
        notifications: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    markAsRead(notificationId: string): Promise<any>;
    deleteNotification(notificationId: string): Promise<void>;
    deleteUserNotifications(userId: string): Promise<any>;
    getNotificationAnalytics(query: AnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalNotifications: any;
        sentNotifications: any;
        deliveryRate: number;
        channelDistribution: any;
        typeDistribution: any;
    }>;
    private queueNotification;
    private scheduleNotification;
    private getUserPreferences;
    private shouldSendNotification;
    private getCategoryFromType;
    private getDateRange;
}
export {};
//# sourceMappingURL=NotificationService.d.ts.map