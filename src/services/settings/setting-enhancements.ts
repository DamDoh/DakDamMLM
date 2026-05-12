import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export class SettingTemplatesService {
  // Get all available templates
  static async getTemplates(category?: string) {
    try {
      const where = category ? { category, isPublic: true } : { isPublic: true };
      return await prisma.settingTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching setting templates:', error);
      return [];
    }
  }

  // Create a new template
  static async createTemplate(templateData: {
    name: string;
    description?: string;
    category: string;
    settings: Record<string, any>;
    createdBy: string;
  }) {
    try {
      return await prisma.settingTemplate.create({
        data: {
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          settings: templateData.settings,
          createdBy: templateData.createdBy
        }
      });
    } catch (error) {
      logger.error('Error creating setting template:', error);
      throw error;
    }
  }

  // Apply template settings
  static async applyTemplate(templateId: string, target: {
    level: 'system' | 'company' | 'user';
    companyId?: string;
    userId?: string;
    performedBy: string;
  }) {
    try {
      const template = await prisma.settingTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new Error('Template not found');
      }

      const results = [];
      for (const [key, value] of Object.entries(template.settings)) {
        const result = await SettingsService.setSetting(target.level, key, value, {
          category: template.category,
          reason: `Applied from template: ${template.name}`,
          performedBy: target.performedBy,
          companyId: target.companyId,
          userId: target.userId
        });
        results.push(result);
      }

      return results;
    } catch (error) {
      logger.error('Error applying setting template:', error);
      throw error;
    }
  }
}

export class ScheduledSettingsService {
  // Schedule a setting change
  static async scheduleSettingChange(scheduleData: {
    settingKey: string;
    settingType: 'system' | 'company' | 'user';
    newValue: any;
    scheduledAt: Date;
    reason?: string;
    createdBy: string;
    companyId?: string;
    userId?: string;
  }) {
    try {
      return await prisma.scheduledSetting.create({
        data: scheduleData
      });
    } catch (error) {
      logger.error('Error scheduling setting change:', error);
      throw error;
    }
  }

  // Get pending scheduled changes
  static async getPendingScheduledChanges() {
    try {
      return await prisma.scheduledSetting.findMany({
        where: {
          status: 'pending',
          scheduledAt: { lte: new Date() }
        },
        orderBy: { scheduledAt: 'asc' }
      });
    } catch (error) {
      logger.error('Error fetching pending scheduled changes:', error);
      return [];
    }
  }

  // Execute scheduled changes (to be called by cron job)
  static async executeScheduledChanges() {
    try {
      const pendingChanges = await this.getPendingScheduledChanges();

      for (const change of pendingChanges) {
        try {
          await SettingsService.setSetting(
            change.settingType as any,
            change.settingKey,
            change.newValue,
            {
              category: 'scheduled_change',
              reason: change.reason || 'Scheduled change execution',
              performedBy: change.createdBy,
              companyId: change.companyId,
              userId: change.userId
            }
          );

          // Mark as executed
          await prisma.scheduledSetting.update({
            where: { id: change.id },
            data: {
              status: 'executed',
              executedAt: new Date()
            }
          });
        } catch (error) {
          logger.error(`Error executing scheduled change ${change.id}:`, error);
        }
      }

      return pendingChanges.length;
    } catch (error) {
      logger.error('Error executing scheduled changes:', error);
      throw error;
    }
  }
}

export class SettingAnalyticsService {
  // Track setting access
  static async trackAccess(settingKey: string, settingType: string, context: {
    companyId?: string;
    userId?: string;
  }) {
    try {
      await prisma.settingAnalytics.upsert({
        where: {
          settingKey_settingType_companyId_userId: {
            settingKey,
            settingType,
            companyId: context.companyId || null,
            userId: context.userId || null
          }
        },
        update: {
          accessCount: { increment: 1 },
          lastAccessed: new Date()
        },
        create: {
          settingKey,
          settingType,
          companyId: context.companyId,
          userId: context.userId,
          accessCount: 1,
          lastAccessed: new Date()
        }
      });
    } catch (error) {
      // Don't fail the main operation for analytics
      logger.warn('Error tracking setting access:', error);
    }
  }

  // Get analytics data
  static async getAnalytics(filters?: {
    settingKey?: string;
    settingType?: string;
    companyId?: string;
    dateRange?: { start: Date; end: Date };
  }) {
    try {
      const where: any = {};

      if (filters?.settingKey) where.settingKey = filters.settingKey;
      if (filters?.settingType) where.settingType = filters.settingType;
      if (filters?.companyId) where.companyId = filters.companyId;

      if (filters?.dateRange) {
        where.createdAt = {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end
        };
      }

      return await prisma.settingAnalytics.findMany({
        where,
        orderBy: { accessCount: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching setting analytics:', error);
      return [];
    }
  }
}

export class SettingGroupsService {
  // Get all setting groups
  static async getGroups(category?: string) {
    try {
      const where = category ? { category } : {};
      return await prisma.settingGroup.findMany({
        where,
        orderBy: { order: 'asc' }
      });
    } catch (error) {
      logger.error('Error fetching setting groups:', error);
      return [];
    }
  }

  // Create setting group
  static async createGroup(groupData: {
    name: string;
    displayName: string;
    description?: string;
    category: string;
    order?: number;
  }) {
    try {
      return await prisma.settingGroup.create({
        data: groupData
      });
    } catch (error) {
      logger.error('Error creating setting group:', error);
      throw error;
    }
  }
}