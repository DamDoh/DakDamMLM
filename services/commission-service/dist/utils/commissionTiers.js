"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionTierService = exports.CommissionTierService = exports.COMMISSION_TIERS = void 0;
const logger_1 = require("./logger");
// Predefined commission tiers
exports.COMMISSION_TIERS = [
    {
        id: 'starter',
        name: 'Starter',
        minSalesVolume: 0,
        maxSalesVolume: 1000,
        directCommissionRate: 0.05, // 5%
        residualCommissionRates: [0.03, 0.02, 0.01], // 3%, 2%, 1%
        bonuses: {},
        requirements: {},
    },
    {
        id: 'bronze',
        name: 'Bronze',
        minSalesVolume: 1000,
        maxSalesVolume: 5000,
        directCommissionRate: 0.08, // 8%
        residualCommissionRates: [0.05, 0.03, 0.02, 0.01], // 5%, 3%, 2%, 1%
        bonuses: {
            fastStart: 100, // $100 bonus for reaching Bronze within 30 days
        },
        requirements: {
            minDirectReferrals: 3,
            minPersonalVolume: 500,
        },
    },
    {
        id: 'silver',
        name: 'Silver',
        minSalesVolume: 5000,
        maxSalesVolume: 15000,
        directCommissionRate: 0.12, // 12%
        residualCommissionRates: [0.08, 0.05, 0.03, 0.02, 0.01], // 8%, 5%, 3%, 2%, 1%
        bonuses: {
            leadership: 0.02, // 2% additional on team volume
        },
        requirements: {
            minDirectReferrals: 5,
            minTeamVolume: 2000,
            minPersonalVolume: 1000,
        },
    },
    {
        id: 'gold',
        name: 'Gold',
        minSalesVolume: 15000,
        maxSalesVolume: 50000,
        directCommissionRate: 0.15, // 15%
        residualCommissionRates: [0.10, 0.08, 0.05, 0.03, 0.02, 0.01], // 10%, 8%, 5%, 3%, 2%, 1%
        bonuses: {
            leadership: 0.05, // 5% additional on team volume
            rankAdvancement: 500, // $500 bonus for reaching Gold
        },
        requirements: {
            minDirectReferrals: 10,
            minTeamVolume: 10000,
            minPersonalVolume: 3000,
        },
    },
    {
        id: 'platinum',
        name: 'Platinum',
        minSalesVolume: 50000,
        maxSalesVolume: 150000,
        directCommissionRate: 0.18, // 18%
        residualCommissionRates: [0.12, 0.10, 0.08, 0.05, 0.03, 0.02, 0.01], // 12%, 10%, 8%, 5%, 3%, 2%, 1%
        bonuses: {
            leadership: 0.08, // 8% additional on team volume
            rankAdvancement: 1000, // $1000 bonus for reaching Platinum
        },
        requirements: {
            minDirectReferrals: 25,
            minTeamVolume: 50000,
            minPersonalVolume: 10000,
        },
    },
    {
        id: 'diamond',
        name: 'Diamond',
        minSalesVolume: 150000,
        directCommissionRate: 0.20, // 20%
        residualCommissionRates: [0.15, 0.12, 0.10, 0.08, 0.05, 0.03, 0.02, 0.01], // 15%, 12%, 10%, 8%, 5%, 3%, 2%, 1%
        bonuses: {
            leadership: 0.10, // 10% additional on team volume
            rankAdvancement: 2500, // $2500 bonus for reaching Diamond
        },
        requirements: {
            minDirectReferrals: 50,
            minTeamVolume: 200000,
            minPersonalVolume: 25000,
        },
    },
];
class CommissionTierService {
    /**
     * Get the appropriate commission tier based on user's sales volume and requirements
     */
    getUserTier(personalVolume, teamVolume, directReferrals) {
        // Find the highest tier the user qualifies for
        let qualifiedTier = exports.COMMISSION_TIERS[0]; // Default to starter
        for (const tier of exports.COMMISSION_TIERS) {
            const meetsRequirements = (!tier.requirements.minDirectReferrals || directReferrals >= tier.requirements.minDirectReferrals) &&
                (!tier.requirements.minTeamVolume || teamVolume >= tier.requirements.minTeamVolume) &&
                (!tier.requirements.minPersonalVolume || personalVolume >= tier.requirements.minPersonalVolume) &&
                personalVolume >= tier.minSalesVolume;
            if (meetsRequirements) {
                qualifiedTier = tier;
            }
            else {
                // Since tiers are ordered by volume, break if requirements not met
                break;
            }
        }
        return qualifiedTier;
    }
    /**
     * Get comprehensive tier information for a user
     */
    getUserTierInfo(personalVolume, teamVolume, directReferrals) {
        const currentTier = this.getUserTier(personalVolume, teamVolume, directReferrals);
        // Find next tier
        const currentTierIndex = exports.COMMISSION_TIERS.findIndex(tier => tier.id === currentTier.id);
        const nextTier = currentTierIndex < exports.COMMISSION_TIERS.length - 1
            ? exports.COMMISSION_TIERS[currentTierIndex + 1]
            : undefined;
        // Calculate progress to next tier
        let progressToNextTier = 100; // Already at max tier
        if (nextTier) {
            const requiredVolume = nextTier.minSalesVolume;
            progressToNextTier = Math.min((personalVolume / requiredVolume) * 100, 100);
        }
        return {
            currentTier,
            nextTier,
            progressToNextTier,
            personalVolume,
            teamVolume,
            directReferrals,
        };
    }
    /**
     * Calculate commission amount based on user's tier
     */
    calculateCommissionWithTier(orderAmount, tier, isDirectSale = true) {
        if (isDirectSale) {
            return orderAmount * tier.directCommissionRate;
        }
        // For residual commissions, use the first residual rate
        return orderAmount * (tier.residualCommissionRates[0] || 0);
    }
    /**
     * Calculate residual commission for a specific level
     */
    calculateResidualCommission(orderAmount, level, tier) {
        const rate = tier.residualCommissionRates[level - 1] || 0;
        return orderAmount * rate;
    }
    /**
     * Check if user qualifies for bonuses
     */
    checkBonusEligibility(tier, daysSinceJoining, personalVolume, teamVolume) {
        const eligibleBonuses = [];
        let totalBonus = 0;
        // Fast start bonus (within 30 days)
        if (tier.bonuses.fastStart && daysSinceJoining <= 30) {
            eligibleBonuses.push('fastStart');
            totalBonus += tier.bonuses.fastStart;
        }
        // Leadership bonus (based on team volume)
        if (tier.bonuses.leadership && teamVolume > 0) {
            const leadershipBonus = teamVolume * tier.bonuses.leadership;
            eligibleBonuses.push('leadership');
            totalBonus += leadershipBonus;
        }
        // Rank advancement bonus
        if (tier.bonuses.rankAdvancement) {
            eligibleBonuses.push('rankAdvancement');
            totalBonus += tier.bonuses.rankAdvancement;
        }
        return { eligibleBonuses, totalBonus };
    }
    /**
     * Get tier by ID
     */
    getTierById(tierId) {
        return exports.COMMISSION_TIERS.find(tier => tier.id === tierId);
    }
    /**
     * Get all available tiers
     */
    getAllTiers() {
        return [...exports.COMMISSION_TIERS];
    }
    /**
     * Validate if a tier configuration is valid
     */
    validateTier(tier) {
        const errors = [];
        if (!tier.id)
            errors.push('Tier ID is required');
        if (!tier.name)
            errors.push('Tier name is required');
        if (typeof tier.minSalesVolume !== 'number')
            errors.push('Minimum sales volume must be a number');
        if (typeof tier.directCommissionRate !== 'number' || tier.directCommissionRate < 0 || tier.directCommissionRate > 1) {
            errors.push('Direct commission rate must be between 0 and 1');
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    /**
     * Log tier-related events
     */
    logTierChange(userId, oldTier, newTier, reason) {
        logger_1.logger.info('User tier changed', {
            userId,
            oldTier,
            newTier,
            reason,
            type: 'tier_change'
        });
    }
    logBonusAwarded(userId, bonusType, amount) {
        logger_1.logger.info('Bonus awarded to user', {
            userId,
            bonusType,
            amount,
            type: 'bonus_awarded'
        });
    }
}
exports.CommissionTierService = CommissionTierService;
// Export singleton instance
exports.commissionTierService = new CommissionTierService();
exports.default = exports.commissionTierService;
//# sourceMappingURL=commissionTiers.js.map