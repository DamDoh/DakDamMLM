import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting notification service database seeding');

  // Create sample users (if they don't exist)
  const sampleUsers = [
    {
      id: 'user-1',
      email: 'john.doe@example.com',
      fullName: 'John Doe',
      memberId: 'M001',
      rank: 'Gold',
      phoneNumber: '+1234567890',
      isAdmin: false,
      active: true,
    },
    {
      id: 'user-2',
      email: 'jane.smith@example.com',
      fullName: 'Jane Smith',
      memberId: 'M002',
      rank: 'Silver',
      phoneNumber: '+1234567891',
      isAdmin: false,
      active: true,
    },
    {
      id: 'user-3',
      email: 'bob.johnson@example.com',
      fullName: 'Bob Johnson',
      memberId: 'M003',
      rank: 'Diamond',
      phoneNumber: '+1234567892',
      isAdmin: false,
      active: true,
    },
    {
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'System Admin',
      memberId: 'ADMIN001',
      rank: 'Diamond',
      phoneNumber: '+1234567893',
      isAdmin: true,
      active: true,
    },
  ];

  for (const user of sampleUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user as any,
      create: user as any,
    });
  }

  logger.info(`Seeded ${sampleUsers.length} sample users`);

  // Create notification templates
  const templates = [
    {
      name: 'Welcome Email',
      type: 'WELCOME',
      channel: 'EMAIL',
      category: 'AUTHENTICATION',
      priority: 'HIGH',
      subject: 'Welcome to Our MLM Platform, {{fullName}}!',
      title: 'Welcome to Our Platform!',
      body: `
        <h1>Welcome {{fullName}}!</h1>
        <p>Thank you for joining our MLM platform. Your member ID is <strong>{{memberId}}</strong>.</p>
        <p>We're excited to have you on board and look forward to your success!</p>
        <p>Best regards,<br>The MLM Team</p>
      `,
      isActive: true,
    },
    {
      name: 'Commission Earned',
      type: 'COMMISSION_EARNED',
      channel: 'EMAIL',
      category: 'COMMISSIONS',
      priority: 'MEDIUM',
      subject: 'Commission Earned: $' + '{{amount}}',
      title: 'Commission Earned!',
      body: `
        <h2>Congratulations {{fullName}}!</h2>
        <p>You've earned a commission of <strong>$` + '{{amount}}' + `</strong> from your downline activity.</p>
        <p>This brings your total earnings to $` + '{{totalEarnings}}' + `.</p>
        <p>Keep up the great work!</p>
      `,
      isActive: true,
    },
    {
      name: 'Order Confirmation',
      type: 'ORDER_PLACED',
      channel: 'EMAIL',
      category: 'ORDERS',
      priority: 'HIGH',
      subject: 'Order Confirmation - Order #{{orderId}}',
      title: 'Order Confirmed!',
      body: `
        <h2>Order Confirmation</h2>
        <p>Dear {{fullName}},</p>
        <p>Your order #{{orderId}} has been successfully placed and is being processed.</p>
        <p><strong>Order Details:</strong></p>
        <ul>
          <li>Items: {{itemCount}}</li>
          <li>Total Amount: $` + '{{amount}}' + `</li>
          <li>Status: Processing</li>
        </ul>
        <p>You will receive another notification when your order ships.</p>
      `,
      isActive: true,
    },
    {
      name: 'Security Alert',
      type: 'SECURITY_ALERT',
      channel: 'EMAIL',
      category: 'SECURITY',
      priority: 'URGENT',
      subject: 'Security Alert - Account Activity',
      title: 'Security Alert',
      body: `
        <h2>Security Alert</h2>
        <p>Dear {{fullName}},</p>
        <p>We detected unusual activity on your account.</p>
        <p>If this wasn't you, please contact support immediately.</p>
        <p>Time: {{timestamp}}</p>
        <p>IP Address: {{ipAddress}}</p>
      `,
      isActive: true,
    },
    {
      name: 'Commission SMS',
      type: 'COMMISSION_EARNED',
      channel: 'SMS',
      category: 'COMMISSIONS',
      priority: 'MEDIUM',
      title: 'Commission Alert',
      body: 'Hi {{fullName}}! You earned $' + '{{amount}}' + ' commission. Total: $' + '{{totalEarnings}}' + '. Great work!',
      isActive: true,
    },
    {
      name: 'Order SMS',
      type: 'ORDER_PLACED',
      channel: 'SMS',
      category: 'ORDERS',
      priority: 'HIGH',
      title: 'Order Confirmation',
      body: 'Order #{{orderId}} confirmed for $' + '{{amount}}' + '. {{itemCount}} items. Track at our website.',
      isActive: true,
    },
  ];

  for (const template of templates) {
    await (prisma as any).notificationTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }

  logger.info(`Seeded ${templates.length} notification templates`);

  // Create user notification preferences
  const preferences = [
    {
      userId: 'user-1',
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      marketingEmails: true,
      transactionalEmails: true,
      commissionAlerts: true,
      orderUpdates: true,
      securityAlerts: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'America/New_York',
    },
    {
      userId: 'user-2',
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      marketingEmails: false,
      transactionalEmails: true,
      commissionAlerts: true,
      orderUpdates: true,
      securityAlerts: true,
      timezone: 'UTC',
    },
    {
      userId: 'user-3',
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      marketingEmails: true,
      transactionalEmails: true,
      commissionAlerts: true,
      orderUpdates: true,
      securityAlerts: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      timezone: 'Europe/London',
    },
    {
      userId: 'admin-1',
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      marketingEmails: false,
      transactionalEmails: true,
      commissionAlerts: true,
      orderUpdates: true,
      securityAlerts: true,
      timezone: 'UTC',
    },
  ];

  for (const preference of preferences) {
    await (prisma as any).notificationPreference.upsert({
      where: { userId: preference.userId },
      update: preference,
      create: preference,
    });
  }

  logger.info(`Seeded ${preferences.length} user notification preferences`);

  // Create sample notifications
  const notifications = [
    {
      userId: 'user-1',
      type: 'WELCOME',
      channel: 'EMAIL',
      category: 'AUTHENTICATION',
      priority: 'HIGH',
      title: 'Welcome to Our Platform!',
      body: 'Welcome John Doe! Thank you for joining our MLM platform.',
      isRead: true,
      isSent: true,
      sentAt: new Date('2025-01-15T10:00:00Z'),
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      userId: 'user-2',
      type: 'COMMISSION_EARNED',
      channel: 'EMAIL',
      category: 'COMMISSIONS',
      priority: 'MEDIUM',
      title: 'Commission Earned!',
      body: 'You\'ve earned a commission of $25.00 from your downline activity.',
      data: { amount: 25.00, totalEarnings: 150.00 },
      isRead: false,
      isSent: true,
      sentAt: new Date('2025-01-20T14:00:00Z'),
      createdAt: new Date('2025-01-20T14:00:00Z'),
    },
    {
      userId: 'user-3',
      type: 'ORDER_PLACED',
      channel: 'EMAIL',
      category: 'ORDERS',
      priority: 'HIGH',
      title: 'Order Confirmed!',
      body: 'Your order #ORD-001 has been successfully placed.',
      data: { orderId: 'ORD-001', amount: 99.99, itemCount: 3 },
      isRead: true,
      isSent: true,
      sentAt: new Date('2025-01-25T09:00:00Z'),
      createdAt: new Date('2025-01-25T09:00:00Z'),
    },
    {
      userId: 'user-1',
      type: 'COMMISSION_EARNED',
      channel: 'SMS',
      category: 'COMMISSIONS',
      priority: 'MEDIUM',
      title: 'Commission Alert',
      body: 'Hi John! You earned $50.00 commission. Total: $350.00. Great work!',
      data: { amount: 50.00, totalEarnings: 350.00 },
      isRead: false,
      isSent: true,
      sentAt: new Date('2025-01-28T16:00:00Z'),
      createdAt: new Date('2025-01-28T16:00:00Z'),
    },
    {
      userId: 'user-2',
      type: 'SECURITY_ALERT',
      channel: 'EMAIL',
      category: 'SECURITY',
      priority: 'URGENT',
      title: 'Security Alert',
      body: 'We detected unusual activity on your account. If this wasn\'t you, please contact support.',
      data: { timestamp: '2025-02-01T11:00:00Z', ipAddress: '192.168.1.100' },
      isRead: false,
      isSent: true,
      sentAt: new Date('2025-02-01T11:00:00Z'),
      createdAt: new Date('2025-02-01T11:00:00Z'),
    },
  ];

  for (const notification of notifications) {
    await prisma.notification.create({
      data: notification as any,
    });
  }

  logger.info(`Seeded ${notifications.length} sample notifications`);

  // Create notification providers
  const providers = [
    {
      name: 'SendGrid Email',
      type: 'EMAIL',
      provider: 'SENDGRID',
      config: {
        apiKey: 'SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        fromEmail: 'noreply@mlm-platform.com',
        fromName: 'MLM Platform',
      },
      isActive: true,
      priority: 1,
      rateLimit: 100,
      dailyLimit: 10000,
      costPerUnit: 0.0001,
    },
    {
      name: 'Twilio SMS',
      type: 'SMS',
      provider: 'TWILIO',
      config: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'your_auth_token',
        fromNumber: '+1234567890',
      },
      isActive: true,
      priority: 1,
      rateLimit: 10,
      dailyLimit: 1000,
      costPerUnit: 0.0075,
    },
    {
      name: 'Firebase Push',
      type: 'PUSH',
      provider: 'FIREBASE',
      config: {
        projectId: 'mlm-platform-xxxxx',
        serviceAccountKey: 'path/to/service-account.json',
      },
      isActive: true,
      priority: 1,
      rateLimit: 1000,
      dailyLimit: 100000,
      costPerUnit: 0,
    },
  ];

  for (const provider of providers) {
    await (prisma as any).notificationProvider.upsert({
      where: { name: provider.name },
      update: provider,
      create: provider,
    });
  }

  logger.info(`Seeded ${providers.length} notification providers`);

  // Create sample campaigns
  const campaigns = [
    {
      name: 'Welcome Campaign',
      description: 'Welcome new members to the platform',
      type: 'INSTANT',
      status: 'COMPLETED',
      targetUsers: { active: true, rank: 'Member' },
      templateId: 'welcome-template-id', // This would be the actual template ID
      sentAt: new Date('2025-01-15T10:00:00Z'),
      completedAt: new Date('2025-01-15T10:30:00Z'),
      totalRecipients: 150,
      sentCount: 148,
      deliveredCount: 145,
      openedCount: 89,
      clickedCount: 23,
      failedCount: 2,
    },
    {
      name: 'Commission Promotion',
      description: 'Promote commission earning opportunities',
      type: 'SCHEDULED',
      status: 'SCHEDULED',
      targetUsers: { active: true },
      templateId: 'commission-template-id',
      scheduledAt: new Date('2025-02-15T09:00:00Z'),
      totalRecipients: 500,
    },
    {
      name: 'Monthly Newsletter',
      description: 'Monthly performance and news update',
      type: 'RECURRING',
      status: 'DRAFT',
      targetUsers: { active: true },
      templateId: 'newsletter-template-id',
      totalRecipients: 1000,
    },
  ];

  for (const campaign of campaigns) {
    await (prisma as any).notificationCampaign.create({
      data: {
        ...campaign,
        createdBy: 'system',
      } as any,
    });
  }

  logger.info(`Seeded ${campaigns.length} sample notification campaigns`);

  logger.info('Notification service database seeding completed successfully');
}

main()
  .catch((e) => {
    logger.error('Error during database seeding', { error: e.message, stack: e.stack });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });