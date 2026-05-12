"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
const api_client_1 = require("../../../../shared/api-client");
const event_publisher_1 = require("../../../../shared/event-publisher");
const uuid_1 = require("uuid");
// Initialize event publisher for this service
const eventPublisher = (0, event_publisher_1.initializeEventPublisher)('commission-service');
class CommissionService {
    async calculateCommissions(orderId) {
        try {
            // Get order details via API
            const orderResponse = await api_client_1.apiClient.getOrder(orderId);
            if (!orderResponse.success) {
                throw new Error('Order not found');
            }
            const order = orderResponse.data;
            // Get user details via API
            const userResponse = await api_client_1.apiClient.getUser(order.userId);
            if (!userResponse.success) {
                throw new Error('User not found');
            }
            const user = userResponse.data;
            // Get genealogy information via API
            const genealogyResponse = await api_client_1.apiClient.getUserGenealogy(user.id);
            const genealogy = genealogyResponse.success ? genealogyResponse.data : null;
            // Get active commission rules (this service still manages its own rules)
            const rules = await this.getActiveCommissionRules();
            // Calculate commissions based on network structure
            const commissions = await this.calculateNetworkCommissions(order, user, genealogy, rules);
            // Save commission calculations (this service manages its own data)
            await this.saveCommissionCalculations(orderId, commissions);
            // Publish domain event
            await (0, event_publisher_1.publishEvent)(event_publisher_1.DomainEvents.commissionCalculated(orderId, commissions));
            // Queue notifications for commission earners
            await this.queueCommissionNotifications(commissions);
            logger_1.logger.info('Commissions calculated successfully', {
                orderId,
                commissionCount: commissions.length,
                totalAmount: commissions.reduce((sum, c) => sum + c.amount, 0),
            });
            return commissions;
        }
        catch (error) {
            (0, logger_1.logCommissionError)(orderId, 'system', error.message);
            throw error;
        }
    }
    async getCommissions(query) {
        const { page, limit, status, type, userId, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (userId)
            where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [commissions, total] = await Promise.all([
            database_1.commissionDb.commission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.commissionDb.commission.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            commissions,
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
    async getCommissionById(commissionId) {
        // Try cache first
        let commission = await cache_1.cacheService.getCachedCommission(commissionId);
        if (commission) {
            return commission;
        }
        // Fetch from database
        commission = await database_1.commissionDb.commission.findUnique({
            where: { id: commissionId },
        });
        if (commission) {
            // Cache for future requests
            await cache_1.cacheService.setCachedCommission(commissionId, commission);
        }
        return commission;
    }
    async getUserCommissions(userId, page = 1, limit = 10, status) {
        const skip = (page - 1) * limit;
        const where = { userId };
        if (status)
            where.status = status;
        const [commissions, total] = await Promise.all([
            database_1.commissionDb.commission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.commissionDb.commission.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            commissions,
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
    async getUserCommissionStats(userId, period) {
        const { startDate, endDate } = this.getDateRange(period);
        const [stats, monthlyStats] = await Promise.all([
            // Overall stats
            database_1.commissionDb.commission.aggregate({
                where: {
                    userId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // Monthly breakdown
            database_1.commissionDb.commission.groupBy({
                by: ['type'],
                where: {
                    userId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
        ]);
        const totalCommissions = stats._count;
        const totalAmount = stats._sum.amount || 0;
        const commissionsByType = monthlyStats.map(stat => ({
            type: stat.type,
            count: stat._count,
            amount: stat._sum.amount || 0,
        }));
        return {
            userId,
            period,
            startDate,
            endDate,
            totalCommissions,
            totalAmount,
            commissionsByType,
            averageCommission: totalCommissions > 0 ? totalAmount / totalCommissions : 0,
        };
    }
    async updateCommissionStatus(commissionId, status) {
        const commission = await database_1.commissionDb.commission.update({
            where: { id: commissionId },
            data: {
                status: status,
                ...(status === 'PAID' ? { paidAt: new Date() } : {}),
                updatedAt: new Date(),
            },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateCommissionCache(commissionId);
        await cache_1.cacheService.invalidateUserCommissionsCache(commission.userId);
        logger_1.logger.info('Commission status updated', {
            commissionId,
            userId: commission.userId,
            oldStatus: commission.status,
            newStatus: status,
        });
        return commission;
    }
    async deleteCommission(commissionId) {
        const commission = await database_1.commissionDb.commission.findUnique({
            where: { id: commissionId },
            select: { userId: true },
        });
        if (!commission) {
            throw new Error('Commission not found');
        }
        await database_1.commissionDb.commission.delete({
            where: { id: commissionId },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateCommissionCache(commissionId);
        await cache_1.cacheService.invalidateUserCommissionsCache(commission.userId);
        logger_1.logger.info('Commission deleted', { commissionId, userId: commission.userId });
    }
    async getCommissionAnalytics(query) {
        const { startDate, endDate } = this.getDateRange(query.period);
        const [stats, typeStats, levelStats, statusStats, topEarners] = await Promise.all([
            // Overall statistics
            database_1.commissionDb.commission.aggregate({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // By type
            database_1.commissionDb.commission.groupBy({
                by: ['type'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // By level
            database_1.commissionDb.commission.groupBy({
                by: ['level'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // By status
            database_1.commissionDb.commission.groupBy({
                by: ['status'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // Top earners
            database_1.commissionDb.commission.groupBy({
                by: ['userId'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                    status: 'PAID',
                },
                _count: true,
                _sum: {
                    amount: true,
                },
                orderBy: {
                    _sum: {
                        amount: 'desc',
                    },
                },
                take: 10,
            }),
        ]);
        const totalCommissions = stats._count;
        const totalAmount = stats._sum.amount || 0;
        const commissionsByType = typeStats.map(stat => ({
            type: stat.type,
            count: stat._count,
            amount: stat._sum.amount || 0,
        }));
        const commissionsByLevel = levelStats.map(stat => ({
            level: stat.level,
            count: stat._count,
            amount: stat._sum.amount || 0,
        }));
        const commissionsByStatus = statusStats.map(stat => ({
            status: stat.status,
            count: stat._count,
            amount: stat._sum.amount || 0,
        }));
        // Calculate paid and pending amounts
        const paidAmount = commissionsByStatus.find(s => s.status === 'PAID')?.amount || 0;
        const pendingAmount = commissionsByStatus.find(s => s.status === 'PENDING')?.amount || 0;
        const topEarnersData = await Promise.all(topEarners.map(async (earner) => {
            try {
                const userResponse = await api_client_1.apiClient.getUser(earner.userId);
                const user = userResponse.success ? userResponse.data : null;
                return {
                    userId: earner.userId,
                    name: user?.fullName || 'Unknown',
                    memberId: user?.memberId || 'Unknown',
                    totalEarned: earner._sum.amount || 0,
                    commissionCount: earner._count,
                };
            }
            catch (error) {
                // Fallback if user service is unavailable
                return {
                    userId: earner.userId,
                    name: 'Unknown',
                    memberId: 'Unknown',
                    totalEarned: earner._sum.amount || 0,
                    commissionCount: earner._count,
                };
            }
        }));
        return {
            period: query.period,
            startDate,
            endDate,
            totalCommissions,
            totalAmount,
            paidAmount,
            pendingAmount,
            averageCommission: totalCommissions > 0 ? totalAmount / totalCommissions : 0,
            commissionsByType,
            commissionsByLevel,
            commissionsByStatus,
            topEarners: topEarnersData,
        };
    }
    async calculateNetworkCommissions(order, user, genealogy, rules) {
        const commissions = [];
        const visitedUsers = new Set();
        // Check if this is a binary commission structure
        const binaryRules = rules.filter(rule => rule.type === 'BINARY');
        if (binaryRules.length > 0) {
            // Calculate binary commissions
            const binaryCommissions = await this.calculateBinaryCommissions(order, user, genealogy, binaryRules);
            commissions.push(...binaryCommissions);
        }
        // Calculate unilevel commissions (existing logic)
        const unilevelRules = rules.filter(rule => rule.type !== 'BINARY');
        if (unilevelRules.length > 0) {
            const unilevelCommissions = await this.calculateUnilevelCommissions(order, user, genealogy, unilevelRules, visitedUsers);
            commissions.push(...unilevelCommissions);
        }
        return commissions;
    }
    async calculateBinaryCommissions(order, user, genealogy, rules) {
        const commissions = [];
        if (!genealogy || !genealogy.children)
            return commissions;
        // Calculate binary commissions based on genealogy tree structure
        const binaryCommissions = await this.calculateBinaryFromGenealogy(user.id, genealogy, order.totalPV, rules);
        commissions.push(...binaryCommissions);
        return commissions;
    }
    async calculateBinaryFromGenealogy(userId, genealogy, orderPV, rules) {
        const commissions = [];
        // Find users who should receive binary commissions
        // This is a simplified implementation - in practice you'd traverse the binary tree
        // and calculate matching bonuses for users who have both left and right legs
        // For now, we'll create a basic binary commission for the immediate upline
        if (genealogy.upline && genealogy.upline.length > 0) {
            const sponsor = genealogy.upline[0]; // Immediate sponsor
            // Check if sponsor has both left and right children (binary qualification)
            if (sponsor.children && sponsor.children.left && sponsor.children.right) {
                const applicableRule = rules.find(rule => rule.level === 1);
                if (applicableRule) {
                    commissions.push({
                        id: (0, uuid_1.v4)(),
                        userId: sponsor.id,
                        orderId: order.id,
                        type: 'BINARY',
                        level: 1,
                        amount: (orderPV * applicableRule.percentage) / 100,
                        percentage: applicableRule.percentage,
                        status: 'PENDING',
                        createdAt: new Date(),
                    });
                }
            }
        }
        return commissions;
    }
    async calculateUnilevelCommissions(order, user, genealogy, rules, visitedUsers) {
        const commissions = [];
        let currentUserId = user.sponsorId;
        let level = 1;
        // Calculate commissions up the network using genealogy data
        while (currentUserId && level <= 5 && !visitedUsers.has(currentUserId)) {
            visitedUsers.add(currentUserId);
            // Get sponsor details via API
            const sponsorResponse = await api_client_1.apiClient.getUser(currentUserId);
            if (!sponsorResponse.success)
                break;
            const currentUser = sponsorResponse.data;
            // Find applicable rules for this level
            const applicableRules = rules.filter(rule => rule.level === level && order.totalPV >= (rule.minAmount || 0));
            for (const rule of applicableRules) {
                const commissionAmount = (order.totalPV * rule.percentage) / 100;
                if (commissionAmount > 0 && (!rule.maxAmount || commissionAmount <= rule.maxAmount)) {
                    commissions.push({
                        id: (0, uuid_1.v4)(),
                        userId: currentUser.id,
                        orderId: order.id,
                        type: rule.type,
                        level: rule.level,
                        amount: commissionAmount,
                        percentage: rule.percentage,
                        status: 'PENDING',
                        createdAt: new Date(),
                    });
                }
            }
            // Move up to next sponsor
            currentUserId = currentUser.sponsorId;
            level++;
        }
        return commissions;
    }
    async getActiveCommissionRules() {
        // Try cache first
        let rules = await cache_1.cacheService.getCachedCommissionRules();
        if (rules) {
            return rules;
        }
        // Fetch from database
        rules = await database_1.commissionDb.commissionRule.findMany({
            where: { isActive: true },
            orderBy: [
                { level: 'asc' },
                { type: 'asc' },
            ],
        });
        // Cache for future requests
        await cache_1.cacheService.setCachedCommissionRules(rules);
        return rules;
    }
    async saveCommissionCalculations(orderId, commissions) {
        const calculation = await database_1.commissionDb.commissionCalculation.create({
            data: {
                orderId,
                totalAmount: commissions.reduce((sum, c) => sum + c.amount, 0),
                totalPV: 0, // This would come from order data
                calculations: commissions,
            },
        });
        // Save individual commissions
        for (const commission of commissions) {
            await database_1.commissionDb.commission.create({
                data: commission,
            });
        }
        return calculation;
    }
    async queueCommissionNotifications(commissions) {
        for (const commission of commissions) {
            // Send notification via API instead of internal queue
            try {
                await api_client_1.apiClient.sendNotification({
                    userId: commission.userId,
                    type: 'commission_earned',
                    title: 'Commission Earned',
                    message: `You have earned $${commission.amount.toFixed(2)} in ${commission.type} commission`,
                    data: {
                        commissionId: commission.id,
                        amount: commission.amount,
                        commissionType: commission.type,
                        level: commission.level,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to send commission notification', {
                    userId: commission.userId,
                    commissionId: commission.id,
                    error: error.message,
                });
            }
        }
    }
    getDateRange(period) {
        const now = new Date();
        let startDate;
        let endDate = now;
        switch (period) {
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
    async healthCheck() {
        try {
            await commissionDatabaseConnection.healthCheck();
            return { status: 'healthy', timestamp: new Date().toISOString() };
        }
        catch (error) {
            return { status: 'unhealthy', timestamp: new Date().toISOString() };
        }
    }
}
exports.CommissionService = CommissionService;
//# sourceMappingURL=CommissionService.js.map