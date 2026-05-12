import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface TrainingProgress {
  userId: string;
  resourceId: string;
  completed: boolean;
  score?: number;
  timeSpent?: number;
  certificateUrl?: string;
  completedAt?: Date;
}

export class TrainingEngine {
  /**
   * Get required training for user's rank
   */
  static async getRequiredTrainingForUser(userId: string): Promise<any[]> {
    try {
      // Get user's current rank
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          rankAdvancements: {
            orderBy: { advancementDate: 'desc' },
            take: 1,
            include: { toRank: true }
          }
        }
      });

      if (!user) return [];

      const currentRank = user.rankAdvancements[0]?.toRank?.name || 'Member';

      // Get required training for this rank
      const requiredTraining = await prisma.trainingResource.findMany({
        where: {
          isRequired: true,
          requiredForRanks: {
            has: currentRank
          }
        },
        include: {
          completions: {
            where: { userId },
            select: { completedAt: true, score: true }
          }
        }
      });

      return requiredTraining.map(resource => ({
        ...resource,
        userCompletion: resource.completions[0] || null,
        isCompleted: resource.completions.length > 0
      }));

    } catch (error) {
      logger.error('Error getting required training:', error);
      return [];
    }
  }

  /**
   * Get available training resources
   */
  static async getAvailableTraining(options: {
    category?: string;
    userId?: string;
    includeCompleted?: boolean;
  } = {}): Promise<any[]> {
    try {
      const where: any = {
        isActive: true
      };

      if (options.category) {
        where.category = options.category;
      }

      const resources = await prisma.trainingResource.findMany({
        where,
        include: {
          completions: options.userId ? {
            where: { userId: options.userId },
            select: { completedAt: true, score: true }
          } : false
        },
        orderBy: { createdAt: 'desc' }
      });

      if (options.userId) {
        return resources.map(resource => ({
          ...resource,
          userCompletion: resource.completions[0] || null,
          isCompleted: resource.completions.length > 0,
          isLocked: this.isResourceLocked(resource, options.userId!)
        }));
      }

      return resources;
    } catch (error) {
      logger.error('Error getting training resources:', error);
      return [];
    }
  }

  /**
   * Check if resource is locked for user (prerequisites)
   */
  private static async isResourceLocked(resource: any, userId: string): Promise<boolean> {
    // Check if user has required rank
    if (resource.requiredForRanks && resource.requiredForRanks.length > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          rankAdvancements: {
            orderBy: { advancementDate: 'desc' },
            take: 1,
            include: { toRank: true }
          }
        }
      });

      const userRank = user?.rankAdvancements[0]?.toRank?.name || 'Member';
      if (!resource.requiredForRanks.includes(userRank)) {
        return true;
      }
    }

    // Check prerequisites
    // This could be extended to check completion of prerequisite resources

    return false;
  }

  /**
   * Record training completion
   */
  static async completeTraining(data: {
    userId: string;
    resourceId: string;
    score?: number;
    timeSpent?: number;
    certificateUrl?: string;
  }): Promise<TrainingProgress> {
    try {
      // Check if already completed
      const existing = await prisma.trainingCompletion.findUnique({
        where: {
          resourceId_userId: {
            resourceId: data.resourceId,
            userId: data.userId
          }
        }
      });

      if (existing) {
        throw new Error('Training already completed');
      }

      const completion = await prisma.trainingCompletion.create({
        data: {
          resourceId: data.resourceId,
          userId: data.userId,
          completedAt: new Date(),
          score: data.score,
          certificateUrl: data.certificateUrl
        },
        include: {
          resource: true
        }
      });

      // Create notification
      await this.createTrainingNotification(data.userId, completion.resource.title, 'completed');

      // Check if this unlocks further training or rank advancement
      await this.checkTrainingMilestones(data.userId);

      const progress: TrainingProgress = {
        userId: data.userId,
        resourceId: data.resourceId,
        completed: true,
        score: data.score,
        timeSpent: data.timeSpent,
        certificateUrl: data.certificateUrl,
        completedAt: new Date()
      };

      logger.info('Training completed', {
        userId: data.userId,
        resourceId: data.resourceId,
        score: data.score
      });

      return progress;

    } catch (error) {
      logger.error('Error completing training:', error);
      throw error;
    }
  }

  /**
   * Check training milestones and potential unlocks
   */
  private static async checkTrainingMilestones(userId: string): Promise<void> {
    try {
      // Check if all required training for current rank is completed
      const requiredTraining = await this.getRequiredTrainingForUser(userId);
      const completedRequired = requiredTraining.filter(t => t.isCompleted);

      if (requiredTraining.length > 0 && completedRequired.length === requiredTraining.length) {
        // All required training completed - check for rank advancement
        const { RankAdvancementEngine } = await import('./rank-advancement-engine');
        const advancementResult = await RankAdvancementEngine.checkRankAdvancement(userId);

        if (advancementResult.qualified) {
          await RankAdvancementEngine.processRankAdvancement(userId, advancementResult);
        }
      }

    } catch (error) {
      logger.error('Error checking training milestones:', error);
    }
  }

  /**
   * Create training resource
   */
  static async createTrainingResource(data: {
    title: string;
    description?: string;
    type: string;
    category: string;
    content: any;
    isRequired?: boolean;
    requiredForRanks?: string[];
    createdBy: string;
  }): Promise<any> {
    try {
      const resource = await prisma.trainingResource.create({
        data: {
          title: data.title,
          description: data.description,
          type: data.type,
          category: data.category,
          content: data.content,
          isRequired: data.isRequired || false,
          requiredForRanks: data.requiredForRanks || [],
          createdBy: data.createdBy
        }
      });

      logger.info('Created training resource', {
        resourceId: resource.id,
        title: data.title,
        type: data.type
      });

      return resource;
    } catch (error) {
      logger.error('Error creating training resource:', error);
      throw error;
    }
  }
}

export class NotificationEngine {
  /**
   * Create and send notification to user
   */
  static async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    priority?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    try {
      await prisma.mlmNotification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || {}
        }
      });

      // Here you could integrate with external notification services
      // (email, SMS, push notifications, etc.)

      logger.info('Created notification', {
        userId: data.userId,
        type: data.type,
        title: data.title
      });

    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications
   */
  static async getUserNotifications(userId: string, options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    try {
      const where: any = { userId };

      if (options.unreadOnly) {
        where.isRead = false;
      }

      const notifications = await prisma.mlmNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 20,
        skip: options.offset || 0
      });

      return notifications;
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.mlmNotification.updateMany({
        where: {
          id: notificationId,
          userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error marking notification read:', error);
      throw error;
    }
  }

  /**
   * Bulk mark notifications as read
   */
  static async markAllNotificationsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.mlmNotification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return result.count;
    } catch (error) {
      logger.error('Error marking all notifications read:', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  static async sendBulkNotifications(data: {
    userIds: string[];
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<number> {
    try {
      const notifications = data.userIds.map(userId => ({
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {}
      }));

      await prisma.mlmNotification.createMany({
        data: notifications
      });

      logger.info('Sent bulk notifications', {
        count: data.userIds.length,
        type: data.type,
        title: data.title
      });

      return data.userIds.length;
    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Auto-generate notifications based on events
   */
  static async generateEventNotifications(): Promise<void> {
    try {
      // Check for rank advancements in last 24 hours
      const recentAdvancements = await prisma.rankAdvancement.findMany({
        where: {
          advancementDate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        include: {
          user: true,
          toRank: true
        }
      });

      for (const advancement of recentAdvancements) {
        await this.createNotification({
          userId: advancement.userId,
          type: 'rank_advancement',
          title: `Congratulations! ${advancement.toRank.displayName} Rank Achieved`,
          message: `You've successfully advanced to ${advancement.toRank.displayName} rank. Keep up the great work!`,
          data: {
            fromRank: advancement.fromRankId,
            toRank: advancement.toRank.name,
            advancementDate: advancement.advancementDate
          },
          priority: 'high'
        });
      }

      // Check for large commission earnings
      const largeCommissions = await prisma.commission.findMany({
        where: {
          amount: { gte: 1000 }, // $1000+ commissions
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        include: { user: true }
      });

      for (const commission of largeCommissions) {
        await this.createNotification({
          userId: commission.userId,
          type: 'large_commission',
          title: `Big Commission Earned!`,
          message: `Congratulations on earning $${commission.amount.toLocaleString()} in commissions!`,
          data: {
            amount: commission.amount,
            type: commission.type
          },
          priority: 'high'
        });
      }

      logger.info('Generated event notifications', {
        advancements: recentAdvancements.length,
        largeCommissions: largeCommissions.length
      });

    } catch (error) {
      logger.error('Error generating event notifications:', error);
    }
  }

  /**
   * Create training completion notification
   */
  private static async createTrainingNotification(
    userId: string,
    resourceTitle: string,
    action: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'training_completion',
      title: `Training ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `You've ${action} the training: ${resourceTitle}`,
      data: {
        resourceTitle,
        action,
        completedAt: new Date()
      }
    });
  }
}