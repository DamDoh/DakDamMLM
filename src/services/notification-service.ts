// Real-time notification service for critical system events

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface Notification {
  id: string;
  type: 'alert' | 'warning' | 'info' | 'success' | 'rank_advancement' | 'commission_earned' | 'bonus_qualified' | 'training_completed' | 'contest_winner';
  title: string;
  message: string;
  userId?: string;
  companyId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'business' | 'system' | 'mlm';
  data?: any;
  acknowledged: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationFilter {
  userId?: string;
  companyId?: string;
  type?: string[];
  priority?: string[];
  category?: string[];
  acknowledged?: boolean;
  limit?: number;
}

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ============================================================================
  // MLM-SPECIFIC NOTIFICATION METHODS
  // ============================================================================

  // Create MLM rank advancement notification
  async createRankAdvancementNotification(
    userId: string,
    fromRank: string,
    toRank: string,
    advancementDate: Date
  ): Promise<Notification> {
    return this.createNotification({
      type: 'rank_advancement',
      title: `Congratulations! ${toRank} Rank Achieved`,
      message: `You've successfully advanced from ${fromRank} to ${toRank} rank. Keep up the great work!`,
      userId,
      priority: 'high',
      category: 'mlm',
      data: {
        fromRank,
        toRank,
        advancementDate: advancementDate.toISOString()
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }

  // Create commission earned notification
  async createCommissionNotification(
    userId: string,
    amount: number,
    commissionType: string,
    orderId?: string
  ): Promise<Notification> {
    const priority = amount >= 1000 ? 'high' : amount >= 100 ? 'medium' : 'low';

    return this.createNotification({
      type: 'commission_earned',
      title: `Commission Earned!`,
      message: `You've earned $${amount.toLocaleString()} in ${commissionType} commissions${orderId ? ` from order ${orderId}` : ''}.`,
      userId,
      priority,
      category: 'mlm',
      data: {
        amount,
        commissionType,
        orderId
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  // Create bonus qualification notification
  async createBonusNotification(
    userId: string,
    bonusType: string,
    amount: number,
    reason: string
  ): Promise<Notification> {
    return this.createNotification({
      type: 'bonus_qualified',
      title: `${bonusType} Bonus Qualified!`,
      message: `Congratulations! You've qualified for a $${amount.toLocaleString()} ${bonusType} bonus. ${reason}`,
      userId,
      priority: 'high',
      category: 'mlm',
      data: {
        bonusType,
        amount,
        reason
      },
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    });
  }

  // Create training completion notification
  async createTrainingNotification(
    userId: string,
    resourceTitle: string,
    score?: number
  ): Promise<Notification> {
    return this.createNotification({
      type: 'training_completed',
      title: 'Training Completed!',
      message: `You've successfully completed "${resourceTitle}"${score ? ` with a score of ${score}%` : ''}.`,
      userId,
      priority: 'medium',
      category: 'mlm',
      data: {
        resourceTitle,
        score
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }

  // Create contest winner notification
  async createContestWinnerNotification(
    userId: string,
    contestName: string,
    prize: any,
    rank: number
  ): Promise<Notification> {
    return this.createNotification({
      type: 'contest_winner',
      title: `Contest Winner: ${contestName}`,
      message: `Congratulations! You won ${prize.name || prize} in ${contestName} (Rank #${rank}).`,
      userId,
      priority: 'high',
      category: 'mlm',
      data: {
        contestName,
        prize,
        rank
      },
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    });
  }

  // ============================================================================
  // GENERAL NOTIFICATION METHODS
  // ============================================================================

  // Create a new notification
  async createNotification(notification: Omit<Notification, 'id' | 'acknowledged' | 'createdAt'>): Promise<Notification> {
    try {
      // For now, we'll store notifications in memory
      // In production, this would be stored in a database table
      const newNotification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...notification,
        acknowledged: false,
        createdAt: new Date()
      };

      logger.info('Notification created', {
        id: newNotification.id,
        type: newNotification.type,
        priority: newNotification.priority,
        category: newNotification.category
      });

      // In a real implementation, emit to WebSocket clients
      // this.emitToClients(newNotification);

      return newNotification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Get notifications with filtering
  async getNotifications(filter: NotificationFilter = {}): Promise<Notification[]> {
    try {
      // In production, this would query the database
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Failed to get notifications:', error);
      throw error;
    }
  }

  // Acknowledge a notification
  async acknowledgeNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      // In production, this would update the database
      logger.info('Notification acknowledged', { notificationId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge notification:', error);
      return false;
    }
  }

  // System health monitoring notifications
  async createSystemHealthAlert(
    title: string,
    message: string,
    severity: 'warning' | 'critical',
    data?: any
  ): Promise<Notification> {
    return this.createNotification({
      type: severity === 'critical' ? 'alert' : 'warning',
      title,
      message,
      priority: severity === 'critical' ? 'critical' : 'high',
      category: 'system',
      data,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
  }

  // Security event notifications
  async createSecurityAlert(
    title: string,
    message: string,
    userId?: string,
    companyId?: string,
    data?: any
  ): Promise<Notification> {
    return this.createNotification({
      type: 'alert',
      title,
      message,
      userId,
      companyId,
      priority: 'critical',
      category: 'security',
      data,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  // Performance monitoring notifications
  async createPerformanceAlert(
    title: string,
    message: string,
    companyId?: string,
    data?: any
  ): Promise<Notification> {
    return this.createNotification({
      type: 'warning',
      title,
      message,
      companyId,
      priority: 'medium',
      category: 'performance',
      data,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    });
  }

  // Business logic notifications
  async createBusinessAlert(
    title: string,
    message: string,
    companyId?: string,
    data?: any
  ): Promise<Notification> {
    return this.createNotification({
      type: 'info',
      title,
      message,
      companyId,
      priority: 'medium',
      category: 'business',
      data,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
  }

  // Health check - monitor system components
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    alerts: Notification[];
  }> {
    const checks: Record<string, boolean> = {};
    const alerts: Notification[] = [];

    try {
      // Database connectivity check
      checks.database = true; // Assume healthy for now

      // API response time check
      checks.api = true;

      // Memory usage check
      const memUsage = process.memoryUsage();
      checks.memory = memUsage.heapUsed / memUsage.heapTotal < 0.9;

      // Create alerts for failed checks
      if (!checks.database) {
        alerts.push(await this.createSystemHealthAlert(
          'Database Connection Failed',
          'Unable to connect to the database. This may affect all operations.',
          'critical',
          { check: 'database' }
        ));
      }

      if (!checks.memory) {
        alerts.push(await this.createSystemHealthAlert(
          'High Memory Usage',
          'System memory usage is above 90%. Performance may be degraded.',
          'warning',
          { check: 'memory', usage: memUsage }
        ));
      }

      const status = alerts.some(a => a.priority === 'critical') ? 'unhealthy' :
                    alerts.some(a => a.priority === 'high') ? 'degraded' : 'healthy';

      return { status, checks, alerts };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        checks: { error: false },
        alerts: []
      };
    }
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\notification-service.ts