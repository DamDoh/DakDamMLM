import { notificationDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';
import Handlebars from 'handlebars';

interface TemplateQuery {
  page: number;
  limit: number;
  type?: string;
  channel?: string;
  isActive?: boolean;
}

interface TemplateAnalyticsQuery {
  period: string;
}

export class TemplateService {
  async createTemplate(templateData: any) {
    const template = await (db as any).notificationTemplate.create({
      data: templateData,
    });

    logger.info('Template created', {
      templateId: template.id,
      name: template.name,
      type: template.type,
      channel: template.channel,
    });

    return template;
  }

  async getTemplates(query: TemplateQuery) {
    const { page, limit, type, channel, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (channel) where.channel = channel;
    if (isActive !== undefined) where.isActive = isActive;

    const [templates, total] = await Promise.all([
      (db as any).notificationTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (db as any).notificationTemplate.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getTemplateById(templateId: string) {
    // Try cache first
    let template = await cacheService.getCachedTemplate(templateId);
    if (template) {
      return template;
    }

    // Fetch from database
    template = await (db as any).notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (template) {
      // Cache for future requests
      await cacheService.setCachedTemplate(templateId, template);
    }

    return template;
  }

  async updateTemplate(templateId: string, updates: any) {
    const template = await (db as any).notificationTemplate.update({
      where: { id: templateId },
      data: updates,
    });

    // Invalidate cache
    await cacheService.invalidateTemplateCache(templateId);

    logger.info('Template updated', {
      templateId,
      name: template.name,
    });

    return template;
  }

  async deleteTemplate(templateId: string) {
    await (db as any).notificationTemplate.delete({
      where: { id: templateId },
    });

    // Invalidate cache
    await cacheService.invalidateTemplateCache(templateId);

    logger.info('Template deleted', { templateId });
  }

  async renderTemplate(templateId: string, variables: Record<string, any>) {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    try {
      const compiledTitle = Handlebars.compile(template.title);
      const compiledBody = Handlebars.compile(template.body);

      const renderedTitle = compiledTitle(variables);
      const renderedBody = compiledBody(variables);

      logger.debug('Template rendered', {
        templateId,
        variables: Object.keys(variables),
      });

      return {
        title: renderedTitle,
        body: renderedBody,
        templateId,
        variables,
      };
    } catch (error) {
      logger.error('Template rendering failed', {
        templateId,
        error: (error as Error).message,
      });
      throw new Error(`Template rendering failed: ${(error as Error).message}`);
    }
  }

  async getTemplateAnalytics(templateId: string, query: TemplateAnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query);

    const [usageStats, performanceStats] = await Promise.all([
      // Usage statistics
      (db as any).notification.count({
        where: {
          templateId: templateId as any,
          createdDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      // Performance statistics
      (db as any).notification.groupBy({
        by: ['isSent'],
        where: {
          templateId: templateId as any,
          createdDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),
    ]);

    const totalSent = (performanceStats as any[]).find((stat: any) => stat.isSent)?._count || 0;
    const totalFailed = (performanceStats as any[]).find((stat: any) => !stat.isSent)?._count || 0;
    const deliveryRate = (usageStats as number) > 0 ? (totalSent / (usageStats as number)) * 100 : 0;

    return {
      templateId,
      period: query.period,
      startDate,
      endDate,
      totalUsage: usageStats,
      totalSent,
      totalFailed,
      deliveryRate,
    };
  }

  private getDateRange(query: TemplateAnalyticsQuery): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (query.period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }
}