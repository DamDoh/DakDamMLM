import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { recordNotificationSent, recordNotificationFailed } from '../utils/metrics';
import { logNotificationSent, logNotificationFailed } from '../utils/logger';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  sendNotification = async (req: Request, res: Response) => {
    const {
      userId,
      type,
      channel,
      title,
      body,
      data,
      priority = 'MEDIUM',
      scheduledAt
    } = (req as any).body;

    try {
      const notification = await this.notificationService.sendNotification({
        userId,
        type,
        channel,
        title,
        body,
        data,
        priority,
        scheduledAt,
      });

      recordNotificationSent(type, channel, 'success');
      logNotificationSent(userId, type, channel, 'queued');

      (res as any).status(201).json({
        success: true,
        data: notification,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordNotificationFailed(channel, error.message);
      logNotificationFailed(userId, type, channel, error.message);

      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  sendBulkNotifications = async (req: Request, res: Response) => {
    try {
      const { notifications } = (req as any).body;

      const results = await this.notificationService.sendBulkNotifications(notifications);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      (res as any).json({
        success: true,
        data: {
          total: notifications.length,
          successful: successCount,
          failed: failureCount,
          results,
        },
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getNotifications = async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        channel,
        startDate,
        endDate
      } = (req as any).query;

      const result = await this.notificationService.getNotifications({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        type: type as string,
        channel: channel as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getNotification = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const notification = await this.notificationService.getNotificationById(id);

      if (!notification) {
        return (res as any).status(404).json({
          success: false,
          error: 'Notification not found',
          timestamp: new Date().toISOString(),
          requestId: (res as any).get('X-Request-ID'),
        });
      }

      (res as any).json({
        success: true,
        data: notification,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getUserNotifications = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const { page = 1, limit = 10, unreadOnly = false } = (req as any).query;

      const result = await this.notificationService.getUserNotifications(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        unreadOnly === 'true'
      );

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  markAsRead = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const notification = await this.notificationService.markAsRead(id);

      (res as any).json({
        success: true,
        data: notification,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  deleteNotification = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      await this.notificationService.deleteNotification(id);

      (res as any).json({
        success: true,
        message: 'Notification deleted successfully',
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  deleteUserNotifications = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const deletedCount = await this.notificationService.deleteUserNotifications(userId);

      (res as any).json({
        success: true,
        data: { deletedCount },
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getNotificationAnalytics = async (req: Request, res: Response) => {
    try {
      const { period = 'month', startDate, endDate } = (req as any).query;

      const analytics = await this.notificationService.getNotificationAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      (res as any).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };
}