// Notification Microservice - Multi-channel Communication
// Handles email, push, SMS, and in-app notifications

import { db } from '../shared/database';
import {
  ServiceErrorHandler,
  ResponseUtils,
  ValidationUtils,
  PerformanceUtils
} from '../shared/utils';
import type { Notification, Member } from '../shared/types';
import { eventBus, EventTypes, DomainEventCreators } from '../shared/event-bus';

// Notification templates
const NOTIFICATION_TEMPLATES = {
  'welcome-email': {
    name: 'Welcome Email',
    title: 'Welcome to DakDam, {{memberName}}!',
    body: 'Congratulations on joining DakDam! Your journey to success starts now. Complete your onboarding to unlock your full potential.',
    type: 'email' as const,
    category: 'onboarding' as const,
    variables: ['memberName'],
  },
  'first-commission': {
    name: 'First Commission',
    title: '🎉 Congratulations! You earned your first commission',
    body: 'Great news {{memberName}}! You\'ve earned ${{amount}} in commissions. Keep up the momentum!',
    type: 'push' as const,
    category: 'commission' as const,
    variables: ['memberName', 'amount'],
  },
  'team-member-joined': {
    name: 'Team Member Joined',
    title: 'New team member: {{newMemberName}}',
    body: '{{sponsorName}}, {{newMemberName}} just joined your team! Help them get started on their journey.',
    type: 'in_app' as const,
    category: 'team' as const,
    variables: ['sponsorName', 'newMemberName'],
  },
  'rank-advance': {
    name: 'Rank Advancement',
    title: '🏆 Congratulations on your promotion!',
    body: 'Amazing work {{memberName}}! You\'ve been promoted to {{newRank}}. Your dedication is paying off!',
    type: 'email' as const,
    category: 'achievement' as const,
    variables: ['memberName', 'newRank'],
  },
  'stockist-order': {
    name: 'Stockist Order Placed',
    title: 'New Stockist Order: {{orderId}}',
    body: 'A new order has been placed by {{stockistLevel}} stockist {{stockistName}}. Please review and process the order.',
    type: 'in_app' as const,
    category: 'order' as const,
    variables: ['orderId', 'stockistLevel', 'stockistName'],
  },
  'stock-request': {
    name: 'Stock Request from Stockist',
    title: 'Stock Request from {{stockistName}}',
    body: '{{stockistName}} ({{stockistLevel}}) has requested new inventory. Please review the request in the admin panel.',
    type: 'in_app' as const,
    category: 'system' as const,
    variables: ['stockistName', 'stockistLevel'],
  },
  'ecash-topup-request': {
    name: 'E-Cash Top-up Request',
    title: 'New E-Cash Top-up Request',
    body: '{{memberName}} has requested a top-up of ${{amount}}. Please review in the admin panel.',
    type: 'in_app' as const,
    category: 'system' as const,
    variables: ['memberName', 'amount'],
  },
};

export interface NotificationPreferences {
  memberId: string;
  email: {
    onboarding: boolean;
    commissions: boolean;
    team: boolean;
    system: boolean;
    achievements: boolean;
  };
  push: {
    onboarding: boolean;
    commissions: boolean;
    team: boolean;
    system: boolean;
    achievements: boolean;
  };
  sms: {
    commissions: boolean;
    urgent: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

class NotificationEngine {
  // Create and send notification
  async createNotification(
    memberId: string,
    templateId: string,
    variables: Record<string, string>,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    data?: Record<string, any>
  ): Promise<string> {
    const timerId = PerformanceUtils.startTimer('createNotification');

    try {
      const template = NOTIFICATION_TEMPLATES[templateId as keyof typeof NOTIFICATION_TEMPLATES];
      if (!template) {
        throw ServiceErrorHandler.createError('TEMPLATE_NOT_FOUND', `Notification template "${templateId}" not found`);
      }

      // Replace variables in title and body
      let title = template.title;
      let body = template.body;

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(regex, value);
        body = body.replace(regex, value);
      });

      const notification: Omit<Notification, 'id'> = {
        memberId,
        type: template.type,
        category: template.category,
        title,
        body,
        isRead: false,
        isSent: false,
        createdDate: new Date().toISOString(),
        priority,
        ...(data && { data }),
      };

      // Store notification in database
      const savedNotification = await db.notification.create({
        data: {
          memberId: notification.memberId,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          isRead: notification.isRead,
          isSent: notification.isSent,
          createdDate: new Date(notification.createdDate),
          priority: notification.priority,
        }
      });

      // Send notification asynchronously
      this.sendNotification({
        ...notification,
        id: savedNotification.id,
      } as Notification).catch(error => {
        console.error('Failed to send notification:', error);
      });

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Notification: Created and queued notification ${savedNotification.id} in ${duration}ms`);

      return savedNotification.id;
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Send notification via appropriate channel
  private async sendNotification(notification: Notification): Promise<boolean> {
    try {
      const preferences = await this.getNotificationPreferences(notification.memberId);

      const isEnabled = await this.isNotificationEnabled(preferences, notification);
      if (!isEnabled) {
        return false;
      }

      if (preferences.quietHours.enabled && this.isInQuietHours(preferences.quietHours)) {
        return false;
      }

      let sent = false;

      switch (notification.type) {
        case 'email':
          sent = await this.sendEmailNotification(notification);
          break;
        case 'push':
          sent = await this.sendPushNotification(notification);
          break;
        case 'sms':
          sent = await this.sendSMSNotification(notification);
          break;
        case 'in_app':
          sent = true; // In-app notifications are considered sent when created
          break;
      }

      if (sent) {
        await db.notification.update({
          where: { id: notification.id },
          data: {
            isSent: true,
            sentDate: new Date().toISOString(),
          }
        });

        // Publish notification sent event
        await eventBus.publish(DomainEventCreators.notificationSent(notification.memberId, notification.id, notification.type));
      }

      return sent;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  // Get user notification preferences
  async getNotificationPreferences(memberId: string): Promise<NotificationPreferences> {
    try {
      const prefs = await db.notificationPreference.findUnique({
        where: { memberId }
      });

      if (prefs) {
        return {
          memberId,
          email: prefs.email as NotificationPreferences['email'],
          push: prefs.push as NotificationPreferences['push'],
          sms: prefs.sms as NotificationPreferences['sms'],
          frequency: prefs.frequency as NotificationPreferences['frequency'],
          quietHours: prefs.quietHours as NotificationPreferences['quietHours'],
        };
      }

      // Default preferences
      return {
        memberId,
        email: { onboarding: true, commissions: true, team: true, system: true, achievements: true },
        push: { onboarding: true, commissions: true, team: true, system: false, achievements: true },
        sms: { commissions: false, urgent: true },
        frequency: 'immediate',
        quietHours: { enabled: true, start: '22:00', end: '08:00' },
      };
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return {
        memberId,
        email: { onboarding: true, commissions: true, team: true, system: true, achievements: true },
        push: { onboarding: true, commissions: true, team: true, system: false, achievements: true },
        sms: { commissions: false, urgent: true },
        frequency: 'immediate',
        quietHours: { enabled: true, start: '22:00', end: '08:00' },
      };
    }
  }

  // Check if notification type is enabled for user
  private async isNotificationEnabled(
    preferences: NotificationPreferences,
    notification: Notification
  ): Promise<boolean> {
    switch (notification.type) {
      case 'email':
        return preferences.email[notification.category as keyof typeof preferences.email] || false;
      case 'push':
        return preferences.push[notification.category as keyof typeof preferences.push] || false;
      case 'sms':
        return preferences.sms[notification.category as keyof typeof preferences.sms] || false;
      case 'in_app':
        return true;
      default:
        return false;
    }
  }

  // Check if current time is in quiet hours
  private isInQuietHours(quietHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const startTime = startHour * 100 + startMin;
    const endTime = endHour * 100 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Send email notification (placeholder for actual email service)
  private async sendEmailNotification(notification: Notification): Promise<boolean> {
    try {
      console.log(`Email Notification: ${notification.title} to ${notification.memberId}`);

      // In production, integrate with email service (SendGrid, SES, etc.)
      // For now, just log and return success
      return true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  // Send push notification (placeholder for actual push service)
  private async sendPushNotification(notification: Notification): Promise<boolean> {
    try {
      console.log(`Push Notification: ${notification.title} to ${notification.memberId}`);

      // In production, integrate with push service (FCM, APNs, etc.)
      // For now, just log and return success
      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  // Send SMS notification (placeholder for actual SMS service)
  private async sendSMSNotification(notification: Notification): Promise<boolean> {
    try {
      console.log(`SMS Notification: ${notification.title} to ${notification.memberId}`);

      // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
      // For now, just log and return success
      return true;
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
      return false;
    }
  }

  // Convenience methods for common notifications
  async triggerWelcomeNotification(memberId: string, memberName: string): Promise<void> {
    await this.createNotification(memberId, 'welcome-email', { memberName }, 'high');
  }

  async triggerCommissionNotification(
    memberId: string,
    memberName: string,
    amount: number
  ): Promise<void> {
    await this.createNotification(
      memberId,
      'first-commission',
      { memberName, amount: amount.toString() },
      'high'
    );
  }

  async triggerTeamMemberNotification(
    sponsorId: string,
    sponsorName: string,
    newMemberName: string
  ): Promise<void> {
    await this.createNotification(
      sponsorId,
      'team-member-joined',
      { sponsorName, newMemberName },
      'medium'
    );
  }

  async triggerRankAdvancementNotification(
    memberId: string,
    memberName: string,
    newRank: string
  ): Promise<void> {
    await this.createNotification(
      memberId,
      'rank-advance',
      { memberName, newRank },
      'high'
    );
  }

  async triggerStockistOrderNotification(
    orderId: string,
    stockist: Member
  ): Promise<void> {
    try {
      const adminUsers = await db.user.findMany({
        where: { isAdmin: true }
      });

      if (adminUsers.length === 0) return;

      const notificationPromises = adminUsers.map(admin =>
        this.createNotification(
          admin.id,
          'stockist-order',
          {
            orderId,
            stockistLevel: stockist.storeOwnerLevel || 'Stockist',
            stockistName: stockist.fullName,
          },
          'high'
        )
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error triggering stockist order notification:', error);
    }
  }

  async triggerStockRequestNotification(stockistName: string, stockistLevel: string): Promise<void> {
    try {
      const adminUsers = await db.user.findMany({
        where: { isAdmin: true }
      });

      if (adminUsers.length === 0) return;

      const notificationPromises = adminUsers.map(admin =>
        this.createNotification(
          admin.id,
          'stock-request',
          { stockistName, stockistLevel },
          'high'
        )
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error triggering stock request notification:', error);
    }
  }

  async triggerEcashTopupRequestNotification(memberName: string, amount: number): Promise<void> {
    try {
      const adminUsers = await db.user.findMany({
        where: { isAdmin: true }
      });

      if (adminUsers.length === 0) return;

      const notificationPromises = adminUsers.map(admin =>
        this.createNotification(
          admin.id,
          'ecash-topup-request',
          { memberName, amount: String(amount) },
          'high'
        )
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error triggering ecash topup request notification:', error);
    }
  }

  // Get notifications for a member
  async getMemberNotifications(
    memberId: string,
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      const notifications = await db.notification.findMany({
        where: {
          memberId,
          ...(unreadOnly && { isRead: false }),
        },
        orderBy: { createdDate: 'desc' },
        take: limit,
      });

      return notifications.map(n => ({
        id: n.id,
        memberId: n.memberId,
        type: n.type as Notification['type'],
        category: n.category,
        title: n.title,
        body: n.body,
        data: n.data as Record<string, any>,
        isRead: n.isRead,
        isSent: n.isSent,
        sentDate: n.sentDate?.toISOString(),
        readDate: n.readDate?.toISOString(),
        createdDate: n.createdDate.toISOString(),
        priority: n.priority as Notification['priority'],
      }));
    } catch (error) {
      console.error('Failed to get member notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string, memberId: string): Promise<boolean> {
    try {
      await db.notification.updateMany({
        where: {
          id: notificationId,
          memberId,
        },
        data: {
          isRead: true,
          readDate: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(
    memberId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      await db.notificationPreference.upsert({
        where: { memberId },
        update: preferences,
        create: {
          memberId,
          email: preferences.email || { onboarding: true, commissions: true, team: true, system: true, achievements: true },
          push: preferences.push || { onboarding: true, commissions: true, team: true, system: false, achievements: true },
          sms: preferences.sms || { commissions: false, urgent: true },
          frequency: preferences.frequency || 'immediate',
          quietHours: preferences.quietHours || { enabled: true, start: '22:00', end: '08:00' },
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let notificationEngineInstance: NotificationEngine | null = null;

function getNotificationEngine(): NotificationEngine {
  if (!notificationEngineInstance) {
    notificationEngineInstance = new NotificationEngine();
  }
  return notificationEngineInstance;
}

// Server actions for API routes
export async function createNotificationServer(
  memberId: string,
  templateId: string,
  variables: Record<string, string>,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<string> {
  try {
    const engine = getNotificationEngine();
    return await engine.createNotification(memberId, templateId, variables, priority);
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

export async function getMemberNotificationsServer(
  memberId: string,
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  try {
    const engine = getNotificationEngine();
    return await engine.getMemberNotifications(memberId, limit, unreadOnly);
  } catch (error) {
    console.error('Failed to get member notifications:', error);
    return [];
  }
}

export async function markNotificationAsReadServer(
  notificationId: string,
  memberId: string
): Promise<boolean> {
  try {
    const engine = getNotificationEngine();
    return await engine.markNotificationAsRead(notificationId, memberId);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

export async function updateNotificationPreferencesServer(
  memberId: string,
  preferences: Partial<NotificationPreferences>
): Promise<boolean> {
  try {
    const engine = getNotificationEngine();
    return await engine.updateNotificationPreferences(memberId, preferences);
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return false;
  }
}

// Convenience functions for common notifications
export async function triggerWelcomeNotification(memberId: string, memberName: string): Promise<void> {
  const engine = getNotificationEngine();
  await engine.triggerWelcomeNotification(memberId, memberName);
}

export async function triggerCommissionNotification(
  memberId: string,
  memberName: string,
  amount: number
): Promise<void> {
  const engine = getNotificationEngine();
  await engine.triggerCommissionNotification(memberId, memberName, amount);
}

export async function triggerTeamMemberNotification(
  sponsorId: string,
  sponsorName: string,
  newMemberName: string
): Promise<void> {
  const engine = getNotificationEngine();
  await engine.triggerTeamMemberNotification(sponsorId, sponsorName, newMemberName);
}

export async function triggerRankAdvancementNotification(
  memberId: string,
  memberName: string,
  newRank: string
): Promise<void> {
  const engine = getNotificationEngine();
  await engine.triggerRankAdvancementNotification(memberId, memberName, newRank);
}