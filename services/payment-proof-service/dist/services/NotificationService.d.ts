export declare class NotificationService {
    private emailServiceUrl;
    private smsServiceUrl;
    notifyUplineOfNewProof(proofId: string): Promise<void>;
    notifyBuyerOfApproval(proofId: string, approved: boolean, notes?: string): Promise<void>;
    notifyAdminsOfEscalation(proofId: string, reason: string): Promise<void>;
    createInAppNotification(userId: string, title: string, body: string, data: Record<string, any>): Promise<void>;
    sendQueuedNotifications(): Promise<void>;
    private sendNotification;
    private sendEmail;
    private sendSMS;
    private sendPush;
    private getUserEmail;
    private getUserPhone;
    startNotificationProcessor(): void;
}
//# sourceMappingURL=NotificationService.d.ts.map