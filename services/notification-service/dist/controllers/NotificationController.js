"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const NotificationService_1 = require("../services/NotificationService");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
class NotificationController {
    constructor() {
        this.sendNotification = async (req, res) => {
            const { userId, type, channel, title, body, data, priority = 'MEDIUM', scheduledAt } = req.body;
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
                (0, metrics_1.recordNotificationSent)(type, channel, 'success');
                (0, logger_1.logNotificationSent)(userId, type, channel, 'queued');
                res.status(201).json({
                    success: true,
                    data: notification,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordNotificationFailed)(channel, error.message);
                (0, logger_1.logNotificationFailed)(userId, type, channel, error.message);
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.sendBulkNotifications = async (req, res) => {
            try {
                const { notifications } = req.body;
                const results = await this.notificationService.sendBulkNotifications(notifications);
                const successCount = results.filter(r => r.success).length;
                const failureCount = results.filter(r => !r.success).length;
                res.json({
                    success: true,
                    data: {
                        total: notifications.length,
                        successful: successCount,
                        failed: failureCount,
                        results,
                    },
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getNotifications = async (req, res) => {
            try {
                const { page = 1, limit = 10, status, type, channel, startDate, endDate } = req.query;
                const result = await this.notificationService.getNotifications({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    type: type,
                    channel: channel,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getNotification = async (req, res) => {
            try {
                const { id } = req.params;
                const notification = await this.notificationService.getNotificationById(id);
                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        error: 'Notification not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: notification,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getUserNotifications = async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 10, unreadOnly = false } = req.query;
                const result = await this.notificationService.getUserNotifications(userId, parseInt(page), parseInt(limit), unreadOnly === 'true');
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.markAsRead = async (req, res) => {
            try {
                const { id } = req.params;
                const notification = await this.notificationService.markAsRead(id);
                res.json({
                    success: true,
                    data: notification,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deleteNotification = async (req, res) => {
            try {
                const { id } = req.params;
                await this.notificationService.deleteNotification(id);
                res.json({
                    success: true,
                    message: 'Notification deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deleteUserNotifications = async (req, res) => {
            try {
                const { userId } = req.params;
                const deletedCount = await this.notificationService.deleteUserNotifications(userId);
                res.json({
                    success: true,
                    data: { deletedCount },
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getNotificationAnalytics = async (req, res) => {
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.notificationService.getNotificationAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.notificationService = new NotificationService_1.NotificationService();
    }
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=NotificationController.js.map