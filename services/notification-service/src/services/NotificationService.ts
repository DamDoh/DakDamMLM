import { notificationDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { queueService } from '../utils/queue';
import { logger, logNotificationSent, logNotificationFailed } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

export class NotificationService {
  async sendNotification(notificationData: SendNotificationData) {
    const {
      userId,
      type,
      channel,
      title,
      body,
      data,
      priority = 'MEDIUM',
      scheduledAt
    } = notificationData;

    // Check user preferences
    const preferences = await this.getUserPreferences(userId);
    if (!this.shouldSendNotification(channel, preferences)) {
      logger.info('Notification blocked by user preferences', {
        userId,
        channel,
        type,
      });
      return null;
    }

    // Create notification record
    const notification = await (db as any).notification.create({
      data: {
        userId,
        type: type as any,
        channel: channel as any,
        category: this.getCategoryFromType(type),
        priority: priority as any,
        title,
        body,
        data,
        scheduledAt,
        isSent: !scheduledAt, // Mark as sent if not scheduled
        sentAt: scheduledAt ? undefined : new Date(),
      },
    });

    // Queue for processing if not scheduled
    if (!scheduledAt) {
      await this.queueNotification(notification);
    } else {
      // Schedule for later
      await this.scheduleNotification(notification);
    }

    logger.info('Notification created', {
      notificationId: notification.id,
      userId,
      type,
      channel,
      scheduled: !!scheduledAt,
    });

    return notification;
  }

  async sendBulkNotifications(notifications: SendNotificationData[]) {
    const results = await Promise.allSettled(
      notifications.map(notification => this.sendNotification(notification))
    );

    return results.map((result, index) => ({
      index,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason?.message : null,
    }));
  }

  async getNotifications(query: NotificationQuery) {
    const { page, limit, status, type, channel, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.isSent = status === 'sent';
    if (type) where.type = type;
    if (channel) where.channel = channel;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [notifications, total] = await Promise.all([
      (db as any).notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              memberId: true,
            },
          },
          template: true,
        },
        orderBy: { createdDate: 'desc' as any },
        skip,
        take: limit,
      }),
      (db as any).notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getNotificationById(notificationId: string) {
    // Try cache first
    let notification = await cacheService.getCachedNotification(notificationId);
    if (notification) {
      return notification;
    }

    // Fetch from database
    notification = await (db as any).notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            memberId: true,
          },
        },
        template: true,
      },
    });

    if (notification) {
      // Cache for future requests
      await cacheService.setCachedNotification(notificationId, notification);
    }

    return notification;
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 10, unreadOnly: boolean = false) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, total] = await Promise.all([
      (db as any).notification.findMany({
        where,
        orderBy: { createdDate: 'desc' as any },
        skip,
        take: limit,
      }),
      (db as any).notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async markAsRead(notificationId: string) {
    const notification = await (db as any).notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readDate: new Date(),
      },
    });

    // Invalidate cache
    await cacheService.invalidateNotificationCache(notificationId);

    return notification;
  }

  async deleteNotification(notificationId: string) {
    await db.notification.delete({
      where: { id: notificationId },
    });

    // Invalidate cache
    await cacheService.invalidateNotificationCache(notificationId);
  }

  async deleteUserNotifications(userId: string) {
    const result = await (db as any).notification.deleteMany({
      where: { userId: userId as any },
    });

    // Invalidate cache
    await cacheService.invalidateUserNotificationsCache(userId);

    return result.count;
  }

  async getNotificationAnalytics(query: AnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query);

    const [stats, channelStats, typeStats] = await Promise.all([
      // Overall statistics
      (db as any).notification.aggregate({
        where: {
          createdDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),
      // Channel distribution
      (db as any).notification.groupBy({
        by: ['channel'] as any,
        where: {
          createdDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),
      // Type distribution
      (db as any).notification.groupBy({
        by: ['type'],
        where: {
          createdDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),
    ]);

    const totalNotifications = (stats as any)._count || 0;

    const channelDistribution = (channelStats as any[]).reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.channel] = stat._count || 0;
      return acc;
    }, {} as Record<string, number>);

    const typeDistribution = (typeStats as any[]).reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.type] = stat._count || 0;
      return acc;
    }, {} as Record<string, number>);

    // Calculate delivery rates (simplified)
    const sentNotifications = await (db as any).notification.count({
      where: {
        createdDate: {
          gte: startDate,
          lte: endDate,
        },
        isSent: true,
      },
    });

    const deliveryRate = totalNotifications > 0 ? (sentNotifications / totalNotifications) * 100 : 0;

    return {
      period: query.period,
      startDate,
      endDate,
      totalNotifications,
      sentNotifications,
      deliveryRate,
      channelDistribution,
      typeDistribution,
    };
  }

  private async queueNotification(notification: any) {
    const message = {
      id: uuidv4(),
      type: 'send_notification',
      data: {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        channel: notification.channel,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      },
    };

    await queueService.publishNotification(message, notification.channel.toLowerCase());
  }

  private async scheduleNotification(notification: any) {
    // In a real implementation, this would use a job scheduler like Bull or Agenda
    logger.info('Notification scheduled', {
      notificationId: notification.id,
      scheduledAt: notification.scheduledAt,
    });
  }

  private async getUserPreferences(userId: string) {
    // Try cache first
    let preferences = await cacheService.getCachedUserPreferences(userId);
    if (preferences) {
      return preferences;
    }

    // Fetch from database
    preferences = await (db as any).userNotificationPreference.findUnique({
      where: { userId },
    });

    if (preferences) {
      // Cache for future requests
      await cacheService.setCachedUserPreferences(userId, preferences);
    }

    return preferences;
  }

  private shouldSendNotification(channel: string, preferences: any): boolean {
    if (!preferences) return true; // Send if no preferences set

    switch (channel.toLowerCase()) {
      case 'email':
        return preferences.emailEnabled;
      case 'sms':
        return preferences.smsEnabled;
      case 'push':
        return preferences.pushEnabled;
      default:
        return true;
    }
  }

  private getCategoryFromType(type: string): string {
    const categoryMap: Record<string, string> = {
      WELCOME: 'AUTHENTICATION',
      PASSWORD_RESET: 'AUTHENTICATION',
      EMAIL_VERIFICATION: 'AUTHENTICATION',
      COMMISSION_EARNED: 'COMMISSIONS',
      COMMISSION_PAID: 'COMMISSIONS',
      ORDER_PLACED: 'ORDERS',
      ORDER_SHIPPED: 'ORDERS',
      ORDER_DELIVERED: 'ORDERS',
      ORDER_CANCELLED: 'ORDERS',
      PAYMENT_SUCCESS: 'PAYMENTS',
      PAYMENT_FAILED: 'PAYMENTS',
      PAYMENT_REFUND: 'PAYMENTS',
      SECURITY_ALERT: 'SECURITY',
      ACCOUNT_SUSPENDED: 'SECURITY',
      RANK_ADVANCEMENT: 'SYSTEM',
      TEAM_GROWTH: 'SYSTEM',
      MONTHLY_REPORT: 'SYSTEM',
      PROMOTIONAL: 'MARKETING',
      SYSTEM_MAINTENANCE: 'SYSTEM',
    };

    return categoryMap[type] || 'SYSTEM';
  }

  private getDateRange(query: AnalyticsQuery): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      switch (query.period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }
}