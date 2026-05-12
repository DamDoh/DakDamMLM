"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const database_1 = require("../config/database");
const queue_1 = require("../utils/queue");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
class CampaignService {
    async createCampaign(campaignData) {
        const campaign = await database_1.notificationDb.notificationCampaign.create({
            data: campaignData,
        });
        logger_1.logger.info('Campaign created', {
            campaignId: campaign.id,
            name: campaign.name,
            type: campaign.type,
            status: campaign.status,
        });
        return campaign;
    }
    async getCampaigns(query) {
        const { page, limit, status, type } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const [campaigns, total] = await Promise.all([
            database_1.notificationDb.notificationCampaign.findMany({
                where,
                include: {
                    template: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.notificationDb.notificationCampaign.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            campaigns,
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
    async getCampaignById(campaignId) {
        return await database_1.notificationDb.notificationCampaign.findUnique({
            where: { id: campaignId },
            include: {
                template: true,
            },
        });
    }
    async updateCampaign(campaignId, updates) {
        const campaign = await database_1.notificationDb.notificationCampaign.update({
            where: { id: campaignId },
            data: updates,
        });
        logger_1.logger.info('Campaign updated', {
            campaignId,
            name: campaign.name,
            status: campaign.status,
        });
        return campaign;
    }
    async deleteCampaign(campaignId) {
        await database_1.notificationDb.notificationCampaign.delete({
            where: { id: campaignId },
        });
        logger_1.logger.info('Campaign deleted', { campaignId });
    }
    async executeCampaign(campaignId) {
        const campaign = await this.getCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status !== 'SCHEDULED' && campaign.status !== 'DRAFT') {
            throw new Error(`Campaign is already ${campaign.status.toLowerCase()}`);
        }
        // Update campaign status
        await this.updateCampaign(campaignId, {
            status: 'RUNNING',
            sentAt: new Date(),
        });
        try {
            // Get target users based on criteria
            const targetUsers = await this.getTargetUsers(campaign.targetUsers);
            if (targetUsers.length === 0) {
                throw new Error('No target users found for campaign');
            }
            // Update total recipients
            await this.updateCampaign(campaignId, {
                totalRecipients: targetUsers.length,
            });
            // Queue notifications for each user
            const notificationPromises = targetUsers.map(userId => this.sendCampaignNotification(campaign, userId));
            const results = await Promise.allSettled(notificationPromises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            // Update campaign with results
            await this.updateCampaign(campaignId, {
                sentCount: successful,
                status: 'COMPLETED',
                completedAt: new Date(),
            });
            (0, logger_1.logCampaignExecuted)(campaignId, successful);
            logger_1.logger.info('Campaign executed successfully', {
                campaignId,
                totalRecipients: targetUsers.length,
                successful,
                failed,
            });
            return {
                campaignId,
                totalRecipients: targetUsers.length,
                sentCount: successful,
                failedCount: failed,
                results: results.map((result, index) => ({
                    userId: targetUsers[index],
                    success: result.status === 'fulfilled',
                    error: result.status === 'rejected' ? result.reason?.message : null,
                })),
            };
        }
        catch (error) {
            // Mark campaign as failed
            await this.updateCampaign(campaignId, {
                status: 'FAILED',
                completedAt: new Date(),
            });
            logger_1.logger.error('Campaign execution failed', {
                campaignId,
                error: error.message,
            });
            throw error;
        }
    }
    async scheduleCampaign(campaignId, scheduledAt) {
        const campaign = await this.updateCampaign(campaignId, {
            status: 'SCHEDULED',
            scheduledAt,
        });
        // In a real implementation, this would schedule a job
        logger_1.logger.info('Campaign scheduled', {
            campaignId,
            scheduledAt,
        });
        return campaign;
    }
    async cancelCampaign(campaignId) {
        const campaign = await this.updateCampaign(campaignId, {
            status: 'CANCELLED',
        });
        logger_1.logger.info('Campaign cancelled', { campaignId });
        return campaign;
    }
    async getCampaignAnalytics(campaignId) {
        const campaign = await this.getCampaignById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        const [notificationStats, logStats] = await Promise.all([
            // Notification delivery statistics
            database_1.notificationDb.notification.groupBy({
                by: ['isSent'],
                where: {
                    createdAt: {
                        gte: campaign.sentAt,
                        lte: campaign.completedAt || new Date(),
                    },
                    // This would need a way to link notifications to campaigns
                    // For now, we'll use a simplified approach
                },
                _count: true,
            }),
            // Log statistics (simplified)
            database_1.notificationDb.notificationLog.count({
                where: {
                // This would need campaign-specific logs
                },
            }),
        ]);
        const sentCount = notificationStats.find((stat) => stat.isSent)?._count || 0;
        const failedCount = notificationStats.find((stat) => !stat.isSent)?._count || 0;
        const deliveryRate = campaign.sentCount > 0 ? (sentCount / campaign.sentCount) * 100 : 0;
        const failureRate = campaign.sentCount > 0 ? (failedCount / campaign.sentCount) * 100 : 0;
        return {
            campaignId,
            campaignName: campaign.name,
            totalRecipients: campaign.totalRecipients,
            sentCount: campaign.sentCount,
            deliveredCount: campaign.deliveredCount,
            openedCount: campaign.openedCount,
            clickedCount: campaign.clickedCount,
            bouncedCount: campaign.failedCount,
            deliveryRate,
            openRate: campaign.sentCount > 0 ? (campaign.openedCount / campaign.sentCount) * 100 : 0,
            clickRate: campaign.sentCount > 0 ? (campaign.clickedCount / campaign.sentCount) * 100 : 0,
            bounceRate: campaign.sentCount > 0 ? (campaign.failedCount / campaign.sentCount) * 100 : 0,
        };
    }
    async getCampaignsAnalytics(query) {
        const { startDate, endDate } = this.getDateRange(query);
        const [campaignStats, performanceStats] = await Promise.all([
            // Campaign statistics
            database_1.notificationDb.notificationCampaign.aggregate({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    totalRecipients: true,
                    sentCount: true,
                    deliveredCount: true,
                    openedCount: true,
                    clickedCount: true,
                },
            }),
            // Performance by type
            database_1.notificationDb.notificationCampaign.groupBy({
                by: ['type'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                    status: 'COMPLETED',
                },
                _count: true,
                _sum: {
                    sentCount: true,
                    deliveredCount: true,
                    openedCount: true,
                    clickedCount: true,
                },
            }),
        ]);
        const totalCampaigns = campaignStats._count;
        const totalRecipients = campaignStats._sum.totalRecipients || 0;
        const totalSent = campaignStats._sum.sentCount || 0;
        const totalDelivered = campaignStats._sum.deliveredCount || 0;
        const totalOpened = campaignStats._sum.openedCount || 0;
        const totalClicked = campaignStats._sum.clickedCount || 0;
        const overallDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
        const overallOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
        const overallClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
        const performanceByType = performanceStats.map((stat) => ({
            type: stat.type,
            count: stat._count,
            sentCount: stat._sum.sentCount || 0,
            deliveredCount: stat._sum.deliveredCount || 0,
            openedCount: stat._sum.openedCount || 0,
            clickedCount: stat._sum.clickedCount || 0,
            deliveryRate: stat._sum.sentCount > 0 ? (stat._sum.deliveredCount || 0) / stat._sum.sentCount * 100 : 0,
            openRate: stat._sum.sentCount > 0 ? (stat._sum.openedCount || 0) / stat._sum.sentCount * 100 : 0,
            clickRate: stat._sum.sentCount > 0 ? (stat._sum.clickedCount || 0) / stat._sum.sentCount * 100 : 0,
        }));
        return {
            period: query.period,
            startDate,
            endDate,
            totalCampaigns,
            totalRecipients,
            totalSent,
            totalDelivered,
            totalOpened,
            totalClicked,
            overallDeliveryRate,
            overallOpenRate,
            overallClickRate,
            performanceByType,
        };
    }
    async getTargetUsers(criteria) {
        // This is a simplified implementation
        // In a real system, this would parse complex targeting criteria
        let where = {};
        if (criteria.rank) {
            where.rank = criteria.rank;
        }
        if (criteria.active !== undefined) {
            where.active = criteria.active;
        }
        if (criteria.hasSponsor !== undefined) {
            where.sponsorId = criteria.hasSponsor ? { not: null } : null;
        }
        const users = await database_1.notificationDb.user.findMany({
            where,
            select: { id: true },
            take: 1000, // Limit for demo purposes
        });
        return users.map((user) => user.id);
    }
    async sendCampaignNotification(campaign, userId) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'campaign_notification',
            data: {
                campaignId: campaign.id,
                userId,
                templateId: campaign.templateId,
                campaignData: campaign,
            },
        };
        await queue_1.queueService.publishCampaignNotification(message);
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
exports.CampaignService = CampaignService;
//# sourceMappingURL=CampaignService.js.map