"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralSystemService = exports.ReferralSystemService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("./logger");
const commissionTiers_1 = require("./commissionTiers");
class ReferralSystemService {
    /**
     * Record a new referral relationship
     */
    async recordReferral(referrerId, referredId, source = 'direct') {
        try {
            // Check if referral already exists
            const existingReferral = await database_1.commissionDb.referral.findFirst({
                where: {
                    referrerId,
                    referredId,
                },
            });
            if (existingReferral) {
                logger_1.logger.warn('Referral already exists', { referrerId, referredId });
                return existingReferral;
            }
            // Determine referral level (direct vs indirect)
            const level = await this.calculateReferralLevel(referrerId, referredId);
            const referral = await database_1.commissionDb.referral.create({
                data: {
                    referrerId,
                    referredId,
                    referralDate: new Date(),
                    status: 'active',
                    commissionEarned: 0,
                    level,
                    source,
                },
            });
            logger_1.logger.info('New referral recorded', {
                referralId: referral.id,
                referrerId,
                referredId,
                level,
                source,
                type: 'referral_created'
            });
            return referral;
        }
        catch (error) {
            logger_1.logger.error('Failed to record referral', {
                referrerId,
                referredId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Calculate the referral level (direct = 1, indirect = 2, etc.)
     */
    async calculateReferralLevel(referrerId, referredId) {
        try {
            // Check if referrer is the direct sponsor
            const directReferral = await database_1.commissionDb.user.findFirst({
                where: {
                    id: referredId,
                    sponsorId: referrerId,
                },
            });
            if (directReferral) {
                return 1; // Direct referral
            }
            // Check genealogy for indirect referrals
            const genealogyPath = await this.findReferralPath(referrerId, referredId);
            return genealogyPath.length + 1; // Level based on path length
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate referral level', {
                referrerId,
                referredId,
                error: error.message
            });
            return 1; // Default to direct referral
        }
    }
    /**
     * Find the referral path in genealogy
     */
    async findReferralPath(referrerId, referredId) {
        const path = [];
        let currentUserId = referredId;
        // Traverse up the genealogy tree
        while (currentUserId) {
            const user = await database_1.commissionDb.user.findUnique({
                where: { id: currentUserId },
                select: { sponsorId: true },
            });
            if (!user?.sponsorId)
                break;
            if (user.sponsorId === referrerId) {
                // Found the referrer in the upline
                return path;
            }
            path.push(user.sponsorId);
            currentUserId = user.sponsorId;
            // Prevent infinite loops (max 10 levels)
            if (path.length > 10)
                break;
        }
        return [];
    }
    /**
     * Calculate commission for a referral-based sale
     */
    async calculateReferralCommission(referrerId, referredId, orderId, orderAmount) {
        try {
            // Get referral relationship
            const referral = await database_1.commissionDb.referral.findFirst({
                where: {
                    referrerId,
                    referredId,
                    status: 'active',
                },
            });
            if (!referral) {
                logger_1.logger.debug('No active referral found', { referrerId, referredId });
                return null;
            }
            // Get referrer's tier information
            const referrerStats = await this.getReferrerStats(referrerId);
            const tier = commissionTiers_1.commissionTierService.getUserTier(referrerStats.personalVolume, referrerStats.teamVolume, referrerStats.directReferrals);
            // Calculate commission based on referral level and tier
            const commissionRate = this.getReferralCommissionRate(referral.level, tier);
            const calculatedCommission = orderAmount * commissionRate;
            const referralCommission = {
                referrerId,
                referredId,
                orderId,
                amount: orderAmount,
                level: referral.level,
                tier,
                commissionRate,
                calculatedCommission,
            };
            logger_1.logger.info('Referral commission calculated', {
                referrerId,
                referredId,
                orderId,
                level: referral.level,
                commissionRate,
                calculatedCommission,
                type: 'referral_commission_calculated'
            });
            return referralCommission;
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate referral commission', {
                referrerId,
                referredId,
                orderId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get commission rate based on referral level and user tier
     */
    getReferralCommissionRate(level, tier) {
        // Use residual commission rates for referral commissions
        const rateIndex = Math.min(level - 1, tier.residualCommissionRates.length - 1);
        return tier.residualCommissionRates[rateIndex] || 0;
    }
    /**
     * Record commission earned from referral
     */
    async recordReferralCommission(referrerId, referredId, orderId, commissionAmount) {
        try {
            // Update referral record
            await database_1.commissionDb.referral.updateMany({
                where: {
                    referrerId,
                    referredId,
                },
                data: {
                    commissionEarned: {
                        increment: commissionAmount,
                    },
                },
            });
            // Create commission record
            await database_1.commissionDb.commission.create({
                data: {
                    userId: referrerId,
                    orderId,
                    amount: commissionAmount,
                    type: 'referral',
                    status: 'Pending',
                    date: new Date(),
                },
            });
            logger_1.logger.info('Referral commission recorded', {
                referrerId,
                referredId,
                orderId,
                commissionAmount,
                type: 'referral_commission_recorded'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to record referral commission', {
                referrerId,
                referredId,
                orderId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get referral statistics for a user
     */
    async getReferralStats(userId) {
        try {
            const referrals = await database_1.commissionDb.referral.findMany({
                where: { referrerId: userId },
                orderBy: { referralDate: 'desc' },
                take: 10, // Recent referrals
            });
            const totalReferrals = await database_1.commissionDb.referral.count({
                where: { referrerId: userId },
            });
            const activeReferrals = await database_1.commissionDb.referral.count({
                where: {
                    referrerId: userId,
                    status: 'active',
                },
            });
            const totalCommissionResult = await database_1.commissionDb.referral.aggregate({
                where: { referrerId: userId },
                _sum: { commissionEarned: true },
            });
            const totalCommissionEarned = totalCommissionResult._sum.commissionEarned || 0;
            const averageCommissionPerReferral = totalReferrals > 0 ? totalCommissionEarned / totalReferrals : 0;
            // Group by referral levels
            const levelStats = await database_1.commissionDb.referral.groupBy({
                by: ['level'],
                where: { referrerId: userId },
                _count: { id: true },
                _sum: { commissionEarned: true },
            });
            const referralLevels = levelStats.map(stat => ({
                level: stat.level,
                count: stat._count.id,
                commissionEarned: stat._sum.commissionEarned || 0,
            }));
            return {
                totalReferrals,
                activeReferrals,
                totalCommissionEarned,
                averageCommissionPerReferral,
                referralLevels,
                recentReferrals: referrals,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get referral stats', {
                userId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get referrer statistics (used for tier calculation)
     */
    async getReferrerStats(userId) {
        try {
            // Get personal volume (commissions earned)
            const personalVolumeResult = await database_1.commissionDb.commission.aggregate({
                where: { userId },
                _sum: { amount: true },
            });
            // Get team volume (from referrals)
            const teamVolumeResult = await database_1.commissionDb.referral.aggregate({
                where: { referrerId: userId },
                _sum: { commissionEarned: true },
            });
            // Get direct referrals count
            const directReferrals = await database_1.commissionDb.referral.count({
                where: {
                    referrerId: userId,
                    level: 1,
                },
            });
            return {
                personalVolume: personalVolumeResult._sum.amount || 0,
                teamVolume: teamVolumeResult._sum.commissionEarned || 0,
                directReferrals,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get referrer stats', {
                userId,
                error: error.message
            });
            return { personalVolume: 0, teamVolume: 0, directReferrals: 0 };
        }
    }
    /**
     * Update referral status
     */
    async updateReferralStatus(referrerId, referredId, status) {
        try {
            await database_1.commissionDb.referral.updateMany({
                where: {
                    referrerId,
                    referredId,
                },
                data: { status },
            });
            logger_1.logger.info('Referral status updated', {
                referrerId,
                referredId,
                status,
                type: 'referral_status_updated'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to update referral status', {
                referrerId,
                referredId,
                status,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get referral network for a user
     */
    async getReferralNetwork(userId, maxDepth = 3) {
        try {
            const network = await this.buildReferralNetwork(userId, maxDepth, 0);
            return network;
        }
        catch (error) {
            logger_1.logger.error('Failed to get referral network', {
                userId,
                error: error.message
            });
            throw error;
        }
    }
    async buildReferralNetwork(userId, maxDepth, currentDepth) {
        if (currentDepth >= maxDepth)
            return null;
        const referrals = await database_1.commissionDb.referral.findMany({
            where: {
                referrerId: userId,
                status: 'active',
            },
            include: {
                referred: {
                    select: {
                        id: true,
                        fullName: true,
                        memberId: true,
                        rank: true,
                    },
                },
            },
        });
        const network = {
            userId,
            referrals: [],
        };
        for (const referral of referrals) {
            const subNetwork = await this.buildReferralNetwork(referral.referredId, maxDepth, currentDepth + 1);
            network.referrals.push({
                referred: referral.referred,
                level: referral.level,
                commissionEarned: referral.commissionEarned,
                referralDate: referral.referralDate,
                subNetwork,
            });
        }
        return network;
    }
    /**
     * Process referral bonuses and rewards
     */
    async processReferralBonuses(userId) {
        try {
            const stats = await this.getReferralStats(userId);
            // Check for milestone bonuses
            if (stats.totalReferrals >= 10 && stats.totalReferrals % 10 === 0) {
                logger_1.logger.info('Referral milestone reached', {
                    userId,
                    totalReferrals: stats.totalReferrals,
                    type: 'referral_milestone'
                });
                // Could trigger bonus commission or reward here
            }
            // Check for high-performing referral periods
            const recentReferrals = stats.recentReferrals.filter(ref => new Date(ref.referralDate).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000);
            if (recentReferrals.length >= 5) {
                logger_1.logger.info('High referral activity detected', {
                    userId,
                    recentReferrals: recentReferrals.length,
                    type: 'referral_activity_spike'
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to process referral bonuses', {
                userId,
                error: error.message
            });
        }
    }
}
exports.ReferralSystemService = ReferralSystemService;
// Export singleton instance
exports.referralSystemService = new ReferralSystemService();
exports.default = exports.referralSystemService;
//# sourceMappingURL=referralSystem.js.map