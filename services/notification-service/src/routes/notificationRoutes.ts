import express from 'express';
import { NotificationController } from '../controllers/NotificationController';

const router = express.Router();
const notificationController = new NotificationController();

// Send notifications
router.post('/send', notificationController.sendNotification);
router.post('/send/bulk', notificationController.sendBulkNotifications);

// Notification management
router.get('/', notificationController.getNotifications);
router.get('/:id', notificationController.getNotification);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

// User notifications
router.get('/user/:userId', notificationController.getUserNotifications);
router.delete('/user/:userId', notificationController.deleteUserNotifications);

// Analytics
router.get('/analytics/summary', notificationController.getNotificationAnalytics);

export { router as notificationRoutes };