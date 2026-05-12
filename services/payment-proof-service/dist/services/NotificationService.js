"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../config/database");
const index_1 = require("../index");
class NotificationService {
    constructor() {
        this.emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://email-service:3003';
        this.smsServiceUrl = process.env.SMS_SERVICE_URL || 'http://sms-service:3005';
    }
    async notifyUplineOfNewProof(proofId) {
        try {
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id: proofId },
                include: {
                    user: true,
                    order: true
                }
            });
            if (!proof) {
                index_1.logger.error('Proof not found for notification', { proofId });
                return;
            }
            // Find upline user
            const uplineUser = await database_1.prisma.user.findFirst({
                where: { id: proof.order.userId }
            });
            if (!uplineUser || !uplineUser.sponsorId) {
                index_1.logger.info('No upline found for user', { userId: proof.userId });
                return;
            }
            const upline = await database_1.prisma.user.findUnique({
                where: { id: uplineUser.sponsorId }
            });
            if (!upline) {
                return;
            }
            // Create notification in queue
            await database_1.prisma.notificationQueue.create({
                data: {
                    userId: upline.id,
                    type: 'email',
                    priority: 'high',
                    subject: 'New Payment Proof Submitted',
                    message: `A new payment proof has been submitted by ${proof.user.firstName} ${proof.user.surname} for order ${proof.order.orderId}`,
                    data: {
                        proofId,
                        orderId: proof.order.id,
                        amount: proof.amount,
                        userName: `${proof.user.firstName} ${proof.user.surname}`
                    }
                }
            });
            // Also create in-app notification
            await this.createInAppNotification(upline.id, 'New Payment Proof', `Payment proof submitted for order ${proof.order.orderId}`, {
                type: 'proof_submitted',
                proofId,
                orderId: proof.order.id
            });
            index_1.logger.info('Upline notified of new proof', { proofId, uplineId: upline.id });
        }
        catch (error) {
            index_1.logger.error('Error notifying upline of new proof', { error: error instanceof Error ? error.message : String(error), proofId });
        }
    }
    async notifyBuyerOfApproval(proofId, approved, notes) {
        try {
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id: proofId },
                include: {
                    user: true,
                    order: true,
                    reviewedBy: true
                }
            });
            if (!proof) {
                return;
            }
            const status = approved ? 'approved' : 'rejected';
            const subject = `Payment Proof ${approved ? 'Approved' : 'Rejected'}`;
            let message = `Your payment proof for order ${proof.order.orderId} has been ${status}.`;
            if (notes) {
                message += ` Notes: ${notes}`;
            }
            // Email notification
            await database_1.prisma.notificationQueue.create({
                data: {
                    userId: proof.userId,
                    type: 'email',
                    priority: approved ? 'normal' : 'high',
                    subject,
                    message,
                    data: {
                        proofId,
                        orderId: proof.order.id,
                        status,
                        notes,
                        reviewedBy: proof.reviewedBy ? `${proof.reviewedBy.firstName} ${proof.reviewedBy.surname}` : null
                    }
                }
            });
            // In-app notification
            await this.createInAppNotification(proof.userId, subject, message, {
                type: 'proof_reviewed',
                proofId,
                approved,
                notes
            });
            // SMS for high-priority notifications
            if (!approved) {
                await database_1.prisma.notificationQueue.create({
                    data: {
                        userId: proof.userId,
                        type: 'sms',
                        priority: 'high',
                        message: `Payment proof for order ${proof.order.orderId} was rejected. Please check your email for details.`
                    }
                });
            }
            index_1.logger.info('Buyer notified of proof review', { proofId, approved, userId: proof.userId });
        }
        catch (error) {
            index_1.logger.error('Error notifying buyer of approval', { error: error instanceof Error ? error.message : String(error), proofId });
        }
    }
    async notifyAdminsOfEscalation(proofId, reason) {
        try {
            // Get all admin users
            const admins = await database_1.prisma.user.findMany({
                where: { ...{ isAdmin: true } }
            });
            const notifications = admins.map((admin) => ({
                userId: admin.id,
                type: 'email',
                priority: 'urgent',
                subject: 'Payment Proof Escalated',
                message: `A payment proof has been escalated and requires admin review. Reason: ${reason}`,
                data: { proofId, reason }
            }));
            await database_1.prisma.notificationQueue.createMany({
                data: notifications
            });
            index_1.logger.info('Admins notified of escalation', { proofId, adminCount: admins.length });
        }
        catch (error) {
            index_1.logger.error('Error notifying admins of escalation', { error: error instanceof Error ? error.message : String(error), proofId });
        }
    }
    async createInAppNotification(userId, title, body, data) {
        try {
            // This would integrate with the main system's notification service
            // For now, we'll create a record that can be polled by the frontend
            await database_1.prisma.notificationQueue.create({
                data: {
                    userId,
                    type: 'in_app',
                    priority: 'normal',
                    subject: title,
                    message: body,
                    data
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error creating in-app notification', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async sendQueuedNotifications() {
        try {
            // Get pending notifications
            const pendingNotifications = await database_1.prisma.notificationQueue.findMany({
                where: {
                    status: 'pending',
                    nextRetryAt: {
                        lte: new Date()
                    }
                },
                take: 50 // Process in batches
            });
            for (const notification of pendingNotifications) {
                try {
                    await this.sendNotification(notification);
                    await database_1.prisma.notificationQueue.update({
                        where: { id: notification.id },
                        data: {
                            status: 'sent',
                            sentAt: new Date()
                        }
                    });
                }
                catch (error) {
                    index_1.logger.error('Error sending notification', {
                        notificationId: notification.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Update retry count and schedule next retry
                    const retryCount = notification.retryCount + 1;
                    const nextRetryAt = new Date(Date.now() + Math.pow(2, retryCount) * 60000); // Exponential backoff
                    if (retryCount >= notification.maxRetries) {
                        await database_1.prisma.notificationQueue.update({
                            where: { id: notification.id },
                            data: {
                                status: 'failed',
                                error: error instanceof Error ? error.message : String(error)
                            }
                        });
                    }
                    else {
                        await database_1.prisma.notificationQueue.update({
                            where: { id: notification.id },
                            data: {
                                retryCount,
                                nextRetryAt,
                                error: error instanceof Error ? error.message : String(error)
                            }
                        });
                    }
                }
            }
        }
        catch (error) {
            index_1.logger.error('Error processing notification queue', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async sendNotification(notification) {
        switch (notification.type) {
            case 'email':
                await this.sendEmail(notification);
                break;
            case 'sms':
                await this.sendSMS(notification);
                break;
            case 'push':
                await this.sendPush(notification);
                break;
            default:
                index_1.logger.warn('Unknown notification type', { type: notification.type });
        }
    }
    async sendEmail(notification) {
        try {
            await axios_1.default.post(`${this.emailServiceUrl}/api/emails/send`, {
                to: await this.getUserEmail(notification.userId),
                subject: notification.subject,
                body: notification.message,
                template: 'payment_proof_notification',
                data: notification.data
            });
        }
        catch (error) {
            throw new Error(`Email service error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async sendSMS(notification) {
        try {
            await axios_1.default.post(`${this.smsServiceUrl}/api/sms/send`, {
                to: await this.getUserPhone(notification.userId),
                message: notification.message
            });
        }
        catch (error) {
            throw new Error(`SMS service error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async sendPush(notification) {
        // TODO: Implement push notification service integration
        index_1.logger.info('Push notification sending not implemented yet', { notificationId: notification.id });
    }
    async getUserEmail(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });
        return user?.email || '';
    }
    async getUserPhone(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { phoneNumber: true }
        });
        return user?.phoneNumber || '';
    }
    // Process notification queue periodically
    startNotificationProcessor() {
        setInterval(() => {
            this.sendQueuedNotifications();
        }, 30000); // Process every 30 seconds
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map