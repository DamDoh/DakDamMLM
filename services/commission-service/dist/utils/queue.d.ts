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
    publishCommission(message: QueueMessage, routingKey?: string): Promise<void>;
    consumeCommissions(queueName: string, handler: (message: QueueMessage) => Promise<void>): Promise<void>;
    publishCommissionCalculation(orderData: any): Promise<void>;
    publishCommissionPayment(commissionData: any): Promise<void>;
    publishPayoutProcessing(payoutData: any): Promise<void>;
    publishBonusCalculation(bonusData: any): Promise<void>;
    publishCommissionNotification(notificationData: any): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        queues?: any;
    }>;
}
export declare const queueService: QueueService;
export default queueService;
//# sourceMappingURL=queue.d.ts.map