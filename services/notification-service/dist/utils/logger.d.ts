import winston from 'winston';
declare const logger: winston.Logger;
export { logger };
export declare const logNotificationSent: (userId: string, notificationType: string, channel: string, status: string) => void;
export declare const logNotificationFailed: (userId: string, notificationType: string, channel: string, reason: string) => void;
export declare const logTemplateRendered: (templateId: string, userId: string) => void;
export declare const logCampaignExecuted: (campaignId: string, recipients: number) => void;
export declare const logProviderError: (provider: string, error: string) => void;
export declare const logWebhookReceived: (provider: string, event: string) => void;
//# sourceMappingURL=logger.d.ts.map