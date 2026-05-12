import type { Member } from '@/lib/types';
import { prisma } from '@/lib/database';

export interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  type: 'email' | 'push' | 'sms' | 'in_app';
  category: 'onboarding' | 'commission' | 'team' | 'system' | 'achievement' | 'order';
  variables: string[]; // Variables that can be replaced in the template
  isActive: boolean;
}

export interface Notification {
  id: string;
  memberId: string;
  type: 'email' | 'push' | 'sms' | 'in_app';
  category: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  isSent: boolean;
  sentDate?: string;
  readDate?: string;
  createdDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

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
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
}

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
    {
      id: 'welcome-email',
      name: 'Welcome Email',
      title: 'Welcome to DakDam, {{memberName}}!',
      body: 'Congratulations on joining DakDam! Your journey to success starts now. Complete your onboarding to unlock your full potential.',
      type: 'email',
      category: 'onboarding',
      variables: ['memberName'],
      isActive: true
    },
    {
      id: 'first-commission',
      name: 'First Commission',
      title: '🎉 Congratulations! You earned your first commission',
      body: 'Great news {{memberName}}! You\'ve earned ${{amount}} in commissions. Keep up the momentum!',
      type: 'push',
      category: 'commission',
      variables: ['memberName', 'amount'],
      isActive: true
    },
    {
      id: 'team-member-joined',
      name: 'Team Member Joined',
      title: 'New team member: {{newMemberName}}',
      body: '{{sponsorName}}, {{newMemberName}} just joined your team! Help them get started on their journey.',
      type: 'in_app',
      category: 'team',
      variables: ['sponsorName', 'newMemberName'],
      isActive: true
    },
    {
      id: 'rank-advance',
      name: 'Rank Advancement',
      title: '🏆 Congratulations on your promotion!',
      body: 'Amazing work {{memberName}}! You\'ve been promoted to {{newRank}}. Your dedication is paying off!',
      type: 'email',
      category: 'achievement',
      variables: ['memberName', 'newRank'],
      isActive: true
    },
    {
      id: 'stockist-order',
      name: 'Stockist Order Placed',
      title: 'New Stockist Order: {{orderId}}',
      body: 'A new order has been placed by {{stockistLevel}} stockist {{stockistName}}. Please review and process the order.',
      type: 'in_app',
      category: 'order',
      variables: ['orderId', 'stockistLevel', 'stockistName'],
      isActive: true
    },
    {
      id: 'stock-request',
      name: 'Stock Request from Stockist',
      title: 'Stock Request from {{stockistName}}',
      body: '{{stockistName}} ({{stockistLevel}}) has requested new inventory. Please review the request in the admin panel.',
      type: 'in_app',
      category: 'system',
      variables: ['stockistName', 'stockistLevel'],
      isActive: true,
    },
    {
      id: 'ecash-topup-request',
      name: 'E-Cash Top-up Request',
      title: 'New E-Cash Top-up Request',
      body: '{{memberName}} has requested a top-up of ${{amount}}. Please review in the admin panel.',
      type: 'in_app',
      category: 'system',
      variables: ['memberName', 'amount'],
      isActive: true,
    },
];

export async function createNotification(
  memberId: string,
  templateId: string,
  variables: Record<string, string>,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  data?: Record<string, any>
): Promise<string> {

  try {
    const template = NOTIFICATION_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Notification template with id "${templateId}" not found`);
    }

    // Replace variables in title and body
    let title = template.title;
    let body = template.body;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, value);
      body = body.replace(regex, value);
    });

    const notification: Omit<Notification, 'id'> & { id?: string } = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      memberId,
      type: template.type,
      category: template.category,
      title,
      body,
      isRead: false,
      isSent: false,
      createdDate: new Date().toISOString(),
      priority
    };

    if (data !== undefined) {
      notification.data = data;
    }

    // Store notification in database using Prisma
    await prisma.notification.create({
      data: {
        memberId: notification.memberId,
        type: notification.type,
        category: notification.category,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        isRead: notification.isRead,
        isSent: notification.isSent,
        sentDate: notification.sentDate ? new Date(notification.sentDate) : null,
        readDate: notification.readDate ? new Date(notification.readDate) : null,
        createdDate: new Date(notification.createdDate),
        priority: notification.priority,
      }
    });

    await sendNotification(notification as Notification);

    return notification.id!;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

export async function sendNotification(notification: Notification): Promise<boolean> {
  try {
    const preferences = await getNotificationPreferences(notification.memberId);

    const isEnabled = await isNotificationEnabled(preferences, notification);
    if (!isEnabled) {

      return false;
    }

    if (preferences.quietHours.enabled && isInQuietHours(preferences.quietHours)) {

      return false;
    }

    let sent = false;
    switch (notification.type) {
      case 'email':
        sent = await sendEmailNotification(notification);
        break;
      case 'push':
        sent = await sendPushNotification(notification);
        break;
      case 'sms':
        sent = await sendSMSNotification(notification);
        break;
      case 'in_app':
        sent = true;
        break;
    }

    if (sent) {
      await prisma.notification.update({
        where: { id: notification.id! },
        data: {
          isSent: true,
          sentDate: new Date().toISOString()
        }
      });
    }

    return sent;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

export async function getNotificationPreferences(memberId: string): Promise<NotificationPreferences> {
  try {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { memberId }
    });

    if (prefs) {
      return {
        memberId,
        email: prefs.email as NotificationPreferences['email'],
        push: prefs.push as NotificationPreferences['push'],
        sms: prefs.sms as NotificationPreferences['sms'],
        frequency: prefs.frequency as NotificationPreferences['frequency'],
        quietHours: prefs.quietHours as NotificationPreferences['quietHours']
      };
    }

    return {
      memberId,
      email: { onboarding: true, commissions: true, team: true, system: true, achievements: true },
      push: { onboarding: true, commissions: true, team: true, system: false, achievements: true },
      sms: { commissions: false, urgent: true },
      frequency: 'immediate',
      quietHours: { enabled: true, start: '22:00', end: '08:00' }
    };
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return {
      memberId,
      email: { onboarding: true, commissions: true, team: true, system: true, achievements: true },
      push: { onboarding: true, commissions: true, team: true, system: false, achievements: true },
      sms: { commissions: false, urgent: true },
      frequency: 'immediate',
      quietHours: { enabled: true, start: '22:00', end: '08:00' }
    };
  }
}

async function isNotificationEnabled(
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

function isInQuietHours(quietHours: { start: string; end: string }): boolean {
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

async function sendEmailNotification(notification: Notification): Promise<boolean> {

  return true;
}

async function sendPushNotification(notification: Notification): Promise<boolean> {

  return true;
}

async function sendSMSNotification(notification: Notification): Promise<boolean> {

  return true;
}

export async function triggerWelcomeNotification(memberId: string, memberName: string): Promise<void> {
  await createNotification(memberId, 'welcome-email', { memberName }, 'high');
}

export async function triggerCommissionNotification(
  memberId: string,
  memberName: string,
  amount: number
): Promise<void> {
  await createNotification(memberId, 'first-commission', { memberName, amount: amount.toString() }, 'high');
}

export async function triggerTeamMemberNotification(
  sponsorId: string,
  sponsorName: string,
  newMemberName: string
): Promise<void> {
  await createNotification(sponsorId, 'team-member-joined', { sponsorName, newMemberName }, 'medium');
}

export async function triggerRankAdvancementNotification(
  memberId: string,
  memberName: string,
  newRank: string
): Promise<void> {
  await createNotification(memberId, 'rank-advance', { memberName, newRank }, 'high');
}

export async function triggerStockistOrderNotification(
  orderId: string,
  stockist: Member
): Promise<void> {
  try {
    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true }
    });

    if (adminUsers.length === 0) return;

    const notificationPromises = adminUsers.map(admin => {
      return createNotification(
        admin.id,
        'stockist-order',
        {
          orderId: orderId,
          stockistLevel: stockist.storeOwnerLevel || 'Stockist',
          stockistName: stockist.fullName
        },
        'high'
      );
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error triggering stockist order notification:', error);
  }
}

export async function triggerStockRequestNotification(request: any): Promise<void> {
  try {
    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true }
    });

    if (adminUsers.length === 0) return;

    const notificationPromises = adminUsers.map(admin =>
      createNotification(
        admin.id,
        'stock-request',
        { stockistName: request.stockistName, stockistLevel: request.stockistLevel },
        'high',
        { requests: request.requests }
      )
    );
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error triggering stock request notification:', error);
  }
}

export async function triggerEcashTopupRequestNotification(request: any): Promise<void> {
  try {
    const adminUsers = await prisma.user.findMany({
      where: {
        isAdmin: true,
        id: { not: request.memberId } // Don't notify the user making the request
      }
    });

    if (adminUsers.length === 0) return;

    const notificationPromises = adminUsers.map(admin => {
      const notifData = { memberName: request.memberName, amount: String(request.amount) };
      return createNotification(admin.id, 'ecash-topup-request', notifData, 'high');
    });
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error triggering ecash topup request notification:', error);
  }
}