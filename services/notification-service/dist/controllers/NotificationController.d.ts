import { Request, Response } from 'express';
export declare class NotificationController {
    private notificationService;
    constructor();
    sendNotification: (req: Request, res: Response) => Promise<void>;
    sendBulkNotifications: (req: Request, res: Response) => Promise<void>;
    getNotifications: (req: Request, res: Response) => Promise<void>;
    getNotification: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getUserNotifications: (req: Request, res: Response) => Promise<void>;
    markAsRead: (req: Request, res: Response) => Promise<void>;
    deleteNotification: (req: Request, res: Response) => Promise<void>;
    deleteUserNotifications: (req: Request, res: Response) => Promise<void>;
    getNotificationAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=NotificationController.d.ts.map