interface QueueMessage {
    id: string;
    type: string;
    data: any;
    priority?: number;
    retryCount?: number;
    maxRetries?: number;
}
declare class QueueService {
    private connection;
    private channel;
    private isConnected;
    private reconnectTimeout;
    constructor();
    connect(): Promise<void>;
    private setupQueues;
    private scheduleReconnect;
    close(): Promise<void>;
    publishNotification(message: QueueMessage, routingKey?: string): Promise<void>;
    consumeNotifications(queueName: string, handler: (message: QueueMessage) => Promise<void>): Promise<void>;
    publishEmailNotification(notificationData: any): Promise<void>;
    publishSMSNotification(notificationData: any): Promise<void>;
    publishPushNotification(notificationData: any): Promise<void>;
    publishCampaignNotification(campaignData: any): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        queues?: any;
    }>;
}
export declare const queueService: QueueService;
export default queueService;
//# sourceMappingURL=queue.d.ts.map