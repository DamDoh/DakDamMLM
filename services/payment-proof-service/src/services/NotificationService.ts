import axios from 'axios';
import { prisma } from '../config/database';
import { logger } from '../index';

export class NotificationService {
  private emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://email-service:3003';
  private smsServiceUrl = process.env.SMS_SERVICE_URL || 'http://sms-service:3005';

  async notifyUplineOfNewProof(proofId: string): Promise<void> {
    try {
      const proof = await (prisma as any).paymentProof.findUnique({
        where: { id: proofId },
        include: {
          user: true,
          order: true
        }
      });

      if (!proof) {
        logger.error('Proof not found for notification', { proofId });
        return;
      }

      // Find upline user
      const uplineUser = await prisma.user.findFirst({
        where: { id: proof.order.userId }
      });

      if (!uplineUser || !(uplineUser as any).sponsorId) {
        logger.info('No upline found for user', { userId: proof.userId });
        return;
      }

      const upline = await prisma.user.findUnique({
        where: { id: (uplineUser as any).sponsorId }
      });

      if (!upline) {
        return;
      }

      // Create notification in queue
      await (prisma as any).notificationQueue.create({
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
      await this.createInAppNotification(
        upline.id,
        'New Payment Proof',
        `Payment proof submitted for order ${proof.order.orderId}`,
        {
          type: 'proof_submitted',
          proofId,
          orderId: proof.order.id
        }
      );

      logger.info('Upline notified of new proof', { proofId, uplineId: upline.id });

    } catch (error) {
      logger.error('Error notifying upline of new proof', { error: error instanceof Error ? error.message : String(error), proofId });
    }
  }

  async notifyBuyerOfApproval(proofId: string, approved: boolean, notes?: string): Promise<void> {
    try {
      const proof = await (prisma as any).paymentProof.findUnique({
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
      await (prisma as any).notificationQueue.create({
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
      await this.createInAppNotification(
        proof.userId,
        subject,
        message,
        {
          type: 'proof_reviewed',
          proofId,
          approved,
          notes
        }
      );

      // SMS for high-priority notifications
      if (!approved) {
        await (prisma as any).notificationQueue.create({
          data: {
            userId: proof.userId,
            type: 'sms',
            priority: 'high',
            message: `Payment proof for order ${proof.order.orderId} was rejected. Please check your email for details.`
          }
        });
      }

      logger.info('Buyer notified of proof review', { proofId, approved, userId: proof.userId });

    } catch (error) {
      logger.error('Error notifying buyer of approval', { error: error instanceof Error ? error.message : String(error), proofId });
    }
  }

  async notifyAdminsOfEscalation(proofId: string, reason: string): Promise<void> {
    try {
      // Get all admin users
      const admins = await prisma.user.findMany({
        where: { ...({ isAdmin: true } as any) }
      });

      const notifications = admins.map((admin: { id: string }) => ({
        userId: admin.id,
        type: 'email' as const,
        priority: 'urgent' as const,
        subject: 'Payment Proof Escalated',
        message: `A payment proof has been escalated and requires admin review. Reason: ${reason}`,
        data: { proofId, reason }
      }));

      await (prisma as any).notificationQueue.createMany({
        data: notifications
      });

      logger.info('Admins notified of escalation', { proofId, adminCount: admins.length });

    } catch (error) {
      logger.error('Error notifying admins of escalation', { error: error instanceof Error ? error.message : String(error), proofId });
    }
  }

  async createInAppNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      // This would integrate with the main system's notification service
      // For now, we'll create a record that can be polled by the frontend

      await (prisma as any).notificationQueue.create({
        data: {
          userId,
          type: 'in_app',
          priority: 'normal',
          subject: title,
          message: body,
          data
        }
      });

    } catch (error) {
      logger.error('Error creating in-app notification', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendQueuedNotifications(): Promise<void> {
    try {
      // Get pending notifications
      const pendingNotifications = await (prisma as any).notificationQueue.findMany({
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
          await (prisma as any).notificationQueue.update({
            where: { id: notification.id },
            data: {
              status: 'sent',
              sentAt: new Date()
            }
          });
        } catch (error) {
          logger.error('Error sending notification', {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : String(error)
          });

          // Update retry count and schedule next retry
          const retryCount = notification.retryCount + 1;
          const nextRetryAt = new Date(Date.now() + Math.pow(2, retryCount) * 60000); // Exponential backoff

          if (retryCount >= notification.maxRetries) {
            await (prisma as any).notificationQueue.update({
              where: { id: notification.id },
              data: {
                status: 'failed',
                error: error instanceof Error ? error.message : String(error)
              }
            });
          } else {
            await (prisma as any).notificationQueue.update({
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

    } catch (error) {
      logger.error('Error processing notification queue', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async sendNotification(notification: any): Promise<void> {
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
        logger.warn('Unknown notification type', { type: notification.type });
    }
  }

  private async sendEmail(notification: any): Promise<void> {
    try {
      await axios.post(`${this.emailServiceUrl}/api/emails/send`, {
        to: await this.getUserEmail(notification.userId),
        subject: notification.subject,
        body: notification.message,
        template: 'payment_proof_notification',
        data: notification.data
      });
    } catch (error) {
      throw new Error(`Email service error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sendSMS(notification: any): Promise<void> {
    try {
      await axios.post(`${this.smsServiceUrl}/api/sms/send`, {
        to: await this.getUserPhone(notification.userId),
        message: notification.message
      });
    } catch (error) {
      throw new Error(`SMS service error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sendPush(notification: any): Promise<void> {
    // TODO: Implement push notification service integration
    logger.info('Push notification sending not implemented yet', { notificationId: notification.id });
  }

  private async getUserEmail(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    return user?.email || '';
  }

  private async getUserPhone(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true }
    });
    return user?.phoneNumber || '';
  }

  // Process notification queue periodically
  startNotificationProcessor(): void {
    setInterval(() => {
      this.sendQueuedNotifications();
    }, 30000); // Process every 30 seconds
  }
}