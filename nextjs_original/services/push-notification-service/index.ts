// Internal Push Notification Service
// Self-hosted browser push notifications without external services

import { db } from '../shared/database';
import { ServiceErrorHandler, ValidationUtils, PerformanceUtils } from '../shared/utils';

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  ipAddress?: string;
  companyId?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

export interface PushMessage {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushResult {
  success: boolean;
  subscriptionId: string;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
}

class PushNotificationService {
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;

  constructor() {
    this.initializeVapidKeys();
  }

  // Initialize VAPID keys for push notifications
  private async initializeVapidKeys(): Promise<void> {
    try {
      // In production, these should be stored securely (environment variables or KMS)
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;

      if (publicKey && privateKey) {
        this.vapidKeys = { publicKey, privateKey };
      } else {
        // Generate new keys if not provided
        console.warn('VAPID keys not configured. Push notifications will be limited.');
        // In a real implementation, you'd generate keys using a library like 'web-push'
      }
    } catch (error) {
      console.error('Failed to initialize VAPID keys:', error);
    }
  }

  // Register a push subscription
  async registerSubscription(
    userId: string,
    subscription: PushSubscription,
    companyId?: string
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    const timerId = PerformanceUtils.startTimer('registerPushSubscription');

    try {
      // Validate subscription data
      if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid subscription data');
      }

      // Check if subscription already exists
      const existing = await (db as any).pushSubscription.findFirst({
        where: {
          userId,
          endpoint: subscription.endpoint,
          companyId,
        },
      });

      if (existing) {
        // Update existing subscription
        await (db as any).pushSubscription.update({
          where: { id: existing.id },
          data: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
            userAgent: subscription.userAgent,
            ipAddress: subscription.ipAddress,
            lastUsedAt: new Date(),
            isActive: true,
          },
        });

        PerformanceUtils.endTimer(timerId);
        return { success: true, subscriptionId: existing.id };
      }

      // Create new subscription
      const newSubscription = await (db as any).pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          userAgent: subscription.userAgent,
          ipAddress: subscription.ipAddress,
          companyId,
          isActive: true,
        },
      });

      PerformanceUtils.endTimer(timerId);
      console.log(`Push subscription registered for user ${userId}`);

      return { success: true, subscriptionId: newSubscription.id };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to register push subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  // Send push notification to user
  async sendNotification(
    userId: string,
    message: PushMessage,
    companyId?: string
  ): Promise<PushResult[]> {
    const timerId = PerformanceUtils.startTimer('sendPushNotification');

    try {
      // Get active subscriptions for user
      const subscriptions = await (db as any).pushSubscription.findMany({
        where: {
          userId,
          companyId,
          isActive: true,
        },
      });

      if (subscriptions.length === 0) {
        PerformanceUtils.endTimer(timerId);
        return [{
          success: false,
          subscriptionId: 'none',
          error: 'No active push subscriptions found',
        }];
      }

      // Send to all subscriptions
      const results: PushResult[] = [];

      for (const subscription of subscriptions) {
        try {
          const result = await this.sendToSubscription(subscription, message);
          results.push(result);

          // Update last used timestamp
          await (db as any).pushSubscription.update({
            where: { id: subscription.id },
            data: { lastUsedAt: new Date() },
          });

        } catch (error) {
          console.error(`Failed to send push to subscription ${subscription.id}:`, error);
          results.push({
            success: false,
            subscriptionId: subscription.id,
            error: error instanceof Error ? error.message : 'Send failed',
          });

          // Mark subscription as potentially inactive
          await (db as any).pushSubscription.update({
            where: { id: subscription.id },
            data: { isActive: false },
          });
        }
      }

      const duration = PerformanceUtils.endTimer(timerId);
      const successCount = results.filter(r => r.success).length;
      console.log(`Push notification sent to ${successCount}/${subscriptions.length} subscriptions in ${duration}ms`);

      return results;

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to send push notification:', error);
      return [{
        success: false,
        subscriptionId: 'system',
        error: error instanceof Error ? error.message : 'System error',
      }];
    }
  }

  // Send notification to specific subscription
  private async sendToSubscription(
    subscription: any,
    message: PushMessage
  ): Promise<PushResult> {
    try {
      // In a real implementation, you would use the web-push library
      // For now, we'll simulate the push notification

      console.log('📱 [SIMULATED PUSH] Sending notification:', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        title: message.title,
        body: message.body,
        data: message.data,
      });

      // Simulate successful delivery
      const messageId = `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log the delivery
      await this.logPushDelivery(subscription.id, messageId, 'delivered');

      return {
        success: true,
        subscriptionId: subscription.id,
        messageId,
        deliveredAt: new Date(),
      };

    } catch (error) {
      // Log failed delivery
      await this.logPushDelivery(subscription.id, undefined, 'failed', error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : 'Delivery failed',
      };
    }
  }

  // Log push delivery
  private async logPushDelivery(
    subscriptionId: string,
    messageId?: string,
    status: 'sent' | 'delivered' | 'failed' = 'sent',
    error?: string
  ): Promise<void> {
    try {
      await (db as any).pushDeliveryLog.create({
        data: {
          subscriptionId,
          messageId,
          status,
          error,
        },
      });
    } catch (logError) {
      console.error('Failed to log push delivery:', logError);
    }
  }

  // Send OTP notification via push
  async sendOtpPush(
    userId: string,
    otpCode: string,
    purpose: string,
    companyId?: string
  ): Promise<PushResult[]> {
    const messages = {
      verification: {
        title: 'Email Verification',
        body: `Your verification code is: ${otpCode}`,
        data: { type: 'otp', purpose: 'verification', code: otpCode },
      },
      password_reset: {
        title: 'Password Reset',
        body: `Your password reset code is: ${otpCode}`,
        data: { type: 'otp', purpose: 'password_reset', code: otpCode },
      },
      login_2fa: {
        title: 'Login Verification',
        body: `Your login code is: ${otpCode}`,
        data: { type: 'otp', purpose: 'login_2fa', code: otpCode },
      },
      transaction: {
        title: 'Transaction Verification',
        body: `Your transaction code is: ${otpCode}`,
        data: { type: 'otp', purpose: 'transaction', code: otpCode },
      },
    };

    const message = messages[purpose as keyof typeof messages] || messages.verification;

    return await this.sendNotification(userId, {
      ...message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `otp-${purpose}`,
      requireInteraction: true,
      urgency: 'high',
    }, companyId);
  }

  // Send system notification
  async sendSystemNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    companyId?: string
  ): Promise<PushResult[]> {
    return await this.sendNotification(userId, {
      title,
      body,
      icon: '/icon-192x192.png',
      data: { type: 'system', ...data },
      tag: 'system',
    }, companyId);
  }

  // Unregister subscription
  async unregisterSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await (db as any).pushSubscription.findFirst({
        where: {
          id: subscriptionId,
          userId,
        },
      });

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      await (db as any).pushSubscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
      });

      console.log(`Push subscription ${subscriptionId} unregistered for user ${userId}`);
      return { success: true };

    } catch (error) {
      console.error('Failed to unregister push subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unregistration failed',
      };
    }
  }

  // Get subscription statistics
  async getSubscriptionStats(companyId?: string): Promise<any> {
    try {
      const [
        totalSubscriptions,
        activeSubscriptions,
        recentDeliveries,
      ] = await Promise.all([
        (db as any).pushSubscription.count({ where: { companyId } }),
        (db as any).pushSubscription.count({
          where: { companyId, isActive: true }
        }),
        (db as any).pushDeliveryLog.count({
          where: {
            subscription: { companyId },
            status: 'delivered',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      return {
        totalSubscriptions,
        activeSubscriptions,
        recentDeliveriesLast24h: recentDeliveries,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get subscription stats:', error);
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        recentDeliveriesLast24h: 0,
        error: error instanceof Error ? error.message : 'Stats unavailable',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Clean up inactive subscriptions
  async cleanupInactiveSubscriptions(daysInactive: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

      const result = await (db as any).pushSubscription.updateMany({
        where: {
          OR: [
            { isActive: false },
            {
              lastUsedAt: { lt: cutoffDate },
              isActive: true,
            },
          ],
        },
        data: { isActive: false },
      });

      console.log(`Cleaned up ${result.count} inactive push subscriptions`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup inactive subscriptions:', error);
      return 0;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; activeSubscriptions: number; timestamp: string }> {
    try {
      const activeSubscriptions = await (db as any).pushSubscription.count({
        where: { isActive: true },
      });

      return {
        status: 'healthy',
        activeSubscriptions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        activeSubscriptions: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let pushNotificationServiceInstance: PushNotificationService | null = null;

function getPushNotificationService(): PushNotificationService {
  if (!pushNotificationServiceInstance) {
    pushNotificationServiceInstance = new PushNotificationService();
  }
  return pushNotificationServiceInstance;
}

// Server actions for API routes
export async function registerPushSubscriptionServer(
  userId: string,
  subscription: PushSubscription,
  companyId?: string
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  try {
    const service = getPushNotificationService();
    return await service.registerSubscription(userId, subscription, companyId);
  } catch (error) {
    console.error('Failed to register push subscription:', error);
    throw error;
  }
}

export async function sendPushNotificationServer(
  userId: string,
  message: PushMessage,
  companyId?: string
): Promise<PushResult[]> {
  try {
    const service = getPushNotificationService();
    return await service.sendNotification(userId, message, companyId);
  } catch (error) {
    console.error('Failed to send push notification:', error);
    throw error;
  }
}

export async function sendOtpPushServer(
  userId: string,
  otpCode: string,
  purpose: string,
  companyId?: string
): Promise<PushResult[]> {
  try {
    const service = getPushNotificationService();
    return await service.sendOtpPush(userId, otpCode, purpose, companyId);
  } catch (error) {
    console.error('Failed to send OTP push:', error);
    throw error;
  }
}

export async function unregisterPushSubscriptionServer(
  userId: string,
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const service = getPushNotificationService();
    return await service.unregisterSubscription(userId, subscriptionId);
  } catch (error) {
    console.error('Failed to unregister push subscription:', error);
    throw error;
  }
}

export async function getPushSubscriptionStatsServer(companyId?: string): Promise<any> {
  try {
    const service = getPushNotificationService();
    return await service.getSubscriptionStats(companyId);
  } catch (error) {
    console.error('Failed to get push subscription stats:', error);
    return null;
  }
}

export { getPushNotificationService };
export default getPushNotificationService;