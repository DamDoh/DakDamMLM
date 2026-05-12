"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
const handlebars_1 = __importDefault(require("handlebars"));
class TemplateService {
    async createTemplate(templateData) {
        const template = await database_1.notificationDb.notificationTemplate.create({
            data: templateData,
        });
        logger_1.logger.info('Template created', {
            templateId: template.id,
            name: template.name,
            type: template.type,
            channel: template.channel,
        });
        return template;
    }
    async getTemplates(query) {
        const { page, limit, type, channel, isActive } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (type)
            where.type = type;
        if (channel)
            where.channel = channel;
        if (isActive !== undefined)
            where.isActive = isActive;
        const [templates, total] = await Promise.all([
            database_1.notificationDb.notificationTemplate.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.notificationDb.notificationTemplate.count({ where }),
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
    async getTemplateById(templateId) {
        // Try cache first
        let template = await cache_1.cacheService.getCachedTemplate(templateId);
        if (template) {
            return template;
        }
        // Fetch from database
        template = await database_1.notificationDb.notificationTemplate.findUnique({
            where: { id: templateId },
        });
        if (template) {
            // Cache for future requests
            await cache_1.cacheService.setCachedTemplate(templateId, template);
        }
        return template;
    }
    async updateTemplate(templateId, updates) {
        const template = await database_1.notificationDb.notificationTemplate.update({
            where: { id: templateId },
            data: updates,
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateTemplateCache(templateId);
        logger_1.logger.info('Template updated', {
            templateId,
            name: template.name,
        });
        return template;
    }
    async deleteTemplate(templateId) {
        await database_1.notificationDb.notificationTemplate.delete({
            where: { id: templateId },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateTemplateCache(templateId);
        logger_1.logger.info('Template deleted', { templateId });
    }
    async renderTemplate(templateId, variables) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        try {
            const compiledTitle = handlebars_1.default.compile(template.title);
            const compiledBody = handlebars_1.default.compile(template.body);
            const renderedTitle = compiledTitle(variables);
            const renderedBody = compiledBody(variables);
            logger_1.logger.debug('Template rendered', {
                templateId,
                variables: Object.keys(variables),
            });
            return {
                title: renderedTitle,
                body: renderedBody,
                templateId,
                variables,
            };
        }
        catch (error) {
            logger_1.logger.error('Template rendering failed', {
                templateId,
                error: error.message,
            });
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }
    async getTemplateAnalytics(templateId, query) {
        const { startDate, endDate } = this.getDateRange(query);
        const [usageStats, performanceStats] = await Promise.all([
            // Usage statistics
            database_1.notificationDb.notification.count({
                where: {
                    templateId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            }),
            // Performance statistics
            database_1.notificationDb.notification.groupBy({
                by: ['isSent'],
                where: {
                    templateId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
            }),
        ]);
        const totalSent = performanceStats.find((stat) => stat.isSent)?._count || 0;
        const totalFailed = performanceStats.find((stat) => !stat.isSent)?._count || 0;
        const deliveryRate = usageStats > 0 ? (totalSent / usageStats) * 100 : 0;
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
    getDateRange(query) {
        const now = new Date();
        let startDate;
        let endDate = now;
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
exports.TemplateService = TemplateService;
//# sourceMappingURL=TemplateService.js.map