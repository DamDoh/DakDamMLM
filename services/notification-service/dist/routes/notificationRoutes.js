"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const NotificationController_1 = require("../controllers/NotificationController");
const router = express_1.default.Router();
exports.notificationRoutes = router;
const notificationController = new NotificationController_1.NotificationController();
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
//# sourceMappingURL=notificationRoutes.js.map