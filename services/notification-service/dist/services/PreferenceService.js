"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class PreferenceService {
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
    async createUserPreferences(userId, preferencesData) {
        const preferences = await database_1.notificationDb.userNotificationPreference.create({
            data: {
                userId,
                ...preferencesData,
            },
        });
        // Cache the preferences
        await cache_1.cacheService.setCachedUserPreferences(userId, preferences);
        logger_1.logger.info('User notification preferences created', { userId });
        return preferences;
    }
    async updateUserPreferences(userId, updates) {
        const preferences = await database_1.notificationDb.userNotificationPreference.update({
            where: { userId },
            data: updates,
        });
        // Update cache
        await cache_1.cacheService.setCachedUserPreferences(userId, preferences);
        logger_1.logger.info('User notification preferences updated', { userId });
        return preferences;
    }
    async bulkUpdatePreferences(updates) {
        const results = [];
        for (const update of updates) {
            try {
                const preferences = await this.updateUserPreferences(update.userId, update.preferences);
                results.push({
                    userId: update.userId,
                    success: true,
                    data: preferences,
                });
            }
            catch (error) {
                results.push({
                    userId: update.userId,
                    success: false,
                    error: error.message,
                });
            }
        }
        logger_1.logger.info('Bulk preferences update completed', {
            total: updates.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
        });
        return results;
    }
    async getPreferencesAnalytics() {
        const [totalPreferences, channelStats, categoryStats] = await Promise.all([
            // Total preferences configured
            database_1.notificationDb.userNotificationPreference.count(),
            // Channel preferences statistics
            database_1.notificationDb.userNotificationPreference.aggregate({
                _count: {
                    emailEnabled: true,
                    smsEnabled: true,
                    pushEnabled: true,
                },
            }),
            // Category preferences statistics
            database_1.notificationDb.userNotificationPreference.aggregate({
                _count: {
                    transactionalEmails: true,
                    marketingEmails: true,
                    commissionAlerts: true,
                    orderUpdates: true,
                    securityAlerts: true,
                },
            }),
        ]);
        const channelPreferences = {
            email: channelStats._count.emailEnabled,
            sms: channelStats._count.smsEnabled,
            push: channelStats._count.pushEnabled,
        };
        const categoryPreferences = {
            transactionalEmails: categoryStats._count.transactionalEmails,
            marketingEmails: categoryStats._count.marketingEmails,
            commissionAlerts: categoryStats._count.commissionAlerts,
            orderUpdates: categoryStats._count.orderUpdates,
            securityAlerts: categoryStats._count.securityAlerts,
        };
        // Calculate engagement rates
        const emailEngagementRate = totalPreferences > 0
            ? (channelStats._count.emailEnabled / totalPreferences) * 100
            : 0;
        const smsEngagementRate = totalPreferences > 0
            ? (channelStats._count.smsEnabled / totalPreferences) * 100
            : 0;
        const pushEngagementRate = totalPreferences > 0
            ? (channelStats._count.pushEnabled / totalPreferences) * 100
            : 0;
        return {
            totalUsersWithPreferences: totalPreferences,
            channelPreferences,
            categoryPreferences,
            engagementRates: {
                email: emailEngagementRate,
                sms: smsEngagementRate,
                push: pushEngagementRate,
            },
            mostPopularChannel: Object.entries(channelPreferences)
                .sort(([, a], [, b]) => b - a)[0][0],
            leastPopularChannel: Object.entries(channelPreferences)
                .sort(([, a], [, b]) => a - b)[0][0],
        };
    }
    async deleteUserPreferences(userId) {
        await database_1.notificationDb.userNotificationPreference.delete({
            where: { userId },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateUserPreferencesCache(userId);
        logger_1.logger.info('User notification preferences deleted', { userId });
    }
    // Utility methods for checking preferences
    async isChannelEnabled(userId, channel) {
        const preferences = await this.getUserPreferences(userId);
        if (!preferences)
            return true; // Default to enabled if no preferences set
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
    async isCategoryEnabled(userId, category) {
        const preferences = await this.getUserPreferences(userId);
        if (!preferences)
            return true; // Default to enabled if no preferences set
        switch (category.toLowerCase()) {
            case 'marketing':
                return preferences.marketingEmails;
            case 'transactional':
                return preferences.transactionalEmails;
            case 'commissions':
                return preferences.commissionAlerts;
            case 'orders':
                return preferences.orderUpdates;
            case 'security':
                return preferences.securityAlerts;
            default:
                return true;
        }
    }
    async isQuietHours(userId) {
        const preferences = await this.getUserPreferences(userId);
        if (!preferences || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return false;
        }
        const now = new Date();
        const userTimezone = preferences.timezone || 'UTC';
        // Convert current time to user's timezone
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
        const currentHour = userTime.getHours();
        const currentMinute = userTime.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;
        const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
        const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;
        if (startTime <= endTime) {
            // Same day quiet hours
            return currentTime >= startTime && currentTime <= endTime;
        }
        else {
            // Overnight quiet hours
            return currentTime >= startTime || currentTime <= endTime;
        }
    }
}
exports.PreferenceService = PreferenceService;
//# sourceMappingURL=PreferenceService.js.map