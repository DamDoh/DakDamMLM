"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const queue_1 = require("../utils/queue");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
class NotificationService {
    async sendNotification(notificationData) {
        const { userId, type, channel, title, body, data, priority = 'MEDIUM', scheduledAt } = notificationData;
        // Check user preferences
        const preferences = await this.getUserPreferences(userId);
        if (!this.shouldSendNotification(channel, preferences)) {
            logger_1.logger.info('Notification blocked by user preferences', {
                userId,
                channel,
                type,
            });
            return null;
        }
        // Create notification record
        const notification = await database_1.notificationDb.notification.create({
            data: {
                userId,
                type: type,
                channel: channel,
                category: this.getCategoryFromType(type),
                priority: priority,
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
        }
        else {
            // Schedule for later
            await this.scheduleNotification(notification);
        }
        logger_1.logger.info('Notification created', {
            notificationId: notification.id,
            userId,
            type,
            channel,
            scheduled: !!scheduledAt,
        });
        return notification;
    }
    async sendBulkNotifications(notifications) {
        const results = await Promise.allSettled(notifications.map(notification => this.sendNotification(notification)));
        return results.map((result, index) => ({
            index,
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason?.message : null,
        }));
    }
    async getNotifications(query) {
        const { page, limit, status, type, channel, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.isSent = status === 'sent';
        if (type)
            where.type = type;
        if (channel)
            where.channel = channel;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [notifications, total] = await Promise.all([
            database_1.notificationDb.notification.findMany({
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
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.notificationDb.notification.count({ where }),
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
    async getNotificationById(notificationId) {
        // Try cache first
        let notification = await cache_1.cacheService.getCachedNotification(notificationId);
        if (notification) {
            return notification;
        }
        // Fetch from database
        notification = await database_1.notificationDb.notification.findUnique({
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
            await cache_1.cacheService.setCachedNotification(notificationId, notification);
        }
        return notification;
    }
    async getUserNotifications(userId, page = 1, limit = 10, unreadOnly = false) {
        const skip = (page - 1) * limit;
        const where = { userId };
        if (unreadOnly)
            where.isRead = false;
        const [notifications, total] = await Promise.all([
            database_1.notificationDb.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.notificationDb.notification.count({ where }),
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
    async markAsRead(notificationId) {
        const notification = await database_1.notificationDb.notification.update({
            where: { id: notificationId },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateNotificationCache(notificationId);
        return notification;
    }
    async deleteNotification(notificationId) {
        await database_1.notificationDb.notification.delete({
            where: { id: notificationId },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateNotificationCache(notificationId);
    }
    async deleteUserNotifications(userId) {
        const result = await database_1.notificationDb.notification.deleteMany({
            where: { userId },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateUserNotificationsCache(userId);
        return result.count;
    }
    async getNotificationAnalytics(query) {
        const { startDate, endDate } = this.getDateRange(query);
        const [stats, channelStats, typeStats] = await Promise.all([
            // Overall statistics
            database_1.notificationDb.notification.aggregate({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
            }),
            // Channel distribution
            database_1.notificationDb.notification.groupBy({
                by: ['channel'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
            }),
            // Type distribution
            database_1.notificationDb.notification.groupBy({
                by: ['type'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
            }),
        ]);
        const totalNotifications = stats._count;
        const channelDistribution = channelStats.reduce((acc, stat) => {
            acc[stat.channel] = stat._count;
            return acc;
        }, {});
        const typeDistribution = typeStats.reduce((acc, stat) => {
            acc[stat.type] = stat._count;
            return acc;
        }, {});
        // Calculate delivery rates (simplified)
        const sentNotifications = await database_1.notificationDb.notification.count({
            where: {
                createdAt: {
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
    async queueNotification(notification) {
        const message = {
            id: (0, uuid_1.v4)(),
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
        await queue_1.queueService.publishNotification(message, notification.channel.toLowerCase());
    }
    async scheduleNotification(notification) {
        // In a real implementation, this would use a job scheduler like Bull or Agenda
        logger_1.logger.info('Notification scheduled', {
            notificationId: notification.id,
            scheduledAt: notification.scheduledAt,
        });
    }
    async getUserPreferences(userId) {
        // Try cache first
        let preferences = await cache_1.cacheService.getCachedUserPreferences(userId);
        if (preferences) {
            return preferences;
        }
        // Fetch from database
        preferences = await database_1.notificationDb.userNotificationPreference.findUnique({
            where: { userId },
        });
        if (preferences) {
            // Cache for future requests
            await cache_1.cacheService.setCachedUserPreferences(userId, preferences);
        }
        return preferences;
    }
    shouldSendNotification(channel, preferences) {
        if (!preferences)
            return true; // Send if no preferences set
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
    getCategoryFromType(type) {
        const categoryMap = {
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
    getDateRange(query) {
        const now = new Date();
        let startDate;
        let endDate = now;
        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate = new Date(query.endDate);
        }
        else {
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
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map