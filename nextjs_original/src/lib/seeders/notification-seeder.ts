import { prisma } from '@/lib/database';

export class NotificationSeeder {
  private readonly sampleNotifications = [
    {
      id: 'notif-1',
      memberId: 'user-2',
      type: 'commission_earned',
      category: 'financial',
      title: 'Commission Earned',
      body: 'You have earned a new commission of $150.00',
      data: { amount: 150.00, type: 'direct_bonus' },
      isRead: false,
      isSent: true,
      priority: 'high'
    },
    {
      id: 'notif-2',
      memberId: 'user-3',
      type: 'rank_achievement',
      category: 'achievement',
      title: 'Rank Promotion',
      body: 'Congratulations! You have been promoted to Silver rank',
      data: { newRank: 'Silver' },
      isRead: true,
      isSent: true,
      priority: 'medium'
    },
    {
      id: 'notif-3',
      memberId: 'user-1',
      type: 'system_update',
      category: 'system',
      title: 'System Maintenance',
      body: 'Scheduled maintenance will occur tonight from 2-4 AM',
      data: {},
      isRead: false,
      isSent: true,
      priority: 'low'
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const notification of this.sampleNotifications) {
      try {
        await prisma.notification.upsert({
          where: { id: notification.id },
          update: {
            type: notification.type,
            category: notification.category,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            isRead: notification.isRead,
            isSent: notification.isSent,
            priority: notification.priority,
          },
          create: {
            id: notification.id,
            memberId: notification.memberId,
            type: notification.type,
            category: notification.category,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            isRead: notification.isRead,
            isSent: notification.isSent,
            createdDate: new Date(),
            priority: notification.priority,
          }
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed notification ${notification.id}:`, error);
      }
    }

    return count;
  }
}