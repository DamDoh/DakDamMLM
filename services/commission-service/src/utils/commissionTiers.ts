import { logger } from './logger';

export interface CommissionTier {
  id: string;
  name: string;
  minSalesVolume: number;
  maxSalesVolume?: number;
  directCommissionRate: number;
  residualCommissionRates: number[];
  bonuses: {
    fastStart?: number;
    leadership?: number;
    rankAdvancement?: number;
  };
  requirements: {
    minDirectReferrals?: number;
    minTeamVolume?: number;
    minPersonalVolume?: number;
  };
}

export interface UserTierInfo {
  currentTier: CommissionTier;
  nextTier?: CommissionTier;
  progressToNextTier: number;
  personalVolume: number;
  teamVolume: number;
  directReferrals: number;
}

// Predefined commission tiers
export const COMMISSION_TIERS: CommissionTier[] = [
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

export class CommissionTierService {
  /**
   * Get the appropriate commission tier based on user's sales volume and requirements
   */
  getUserTier(personalVolume: number, teamVolume: number, directReferrals: number): CommissionTier {
    // Find the highest tier the user qualifies for
    let qualifiedTier = COMMISSION_TIERS[0]; // Default to starter

    for (const tier of COMMISSION_TIERS) {
      const meetsRequirements =
        (!tier.requirements.minDirectReferrals || directReferrals >= tier.requirements.minDirectReferrals) &&
        (!tier.requirements.minTeamVolume || teamVolume >= tier.requirements.minTeamVolume) &&
        (!tier.requirements.minPersonalVolume || personalVolume >= tier.requirements.minPersonalVolume) &&
        personalVolume >= tier.minSalesVolume;

      if (meetsRequirements) {
        qualifiedTier = tier;
      } else {
        // Since tiers are ordered by volume, break if requirements not met
        break;
      }
    }

    return qualifiedTier;
  }

  /**
   * Get comprehensive tier information for a user
   */
  getUserTierInfo(
    personalVolume: number,
    teamVolume: number,
    directReferrals: number
  ): UserTierInfo {
    const currentTier = this.getUserTier(personalVolume, teamVolume, directReferrals);

    // Find next tier
    const currentTierIndex = COMMISSION_TIERS.findIndex(tier => tier.id === currentTier.id);
    const nextTier = currentTierIndex < COMMISSION_TIERS.length - 1
      ? COMMISSION_TIERS[currentTierIndex + 1]
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
  calculateCommissionWithTier(
    orderAmount: number,
    tier: CommissionTier,
    isDirectSale: boolean = true
  ): number {
    if (isDirectSale) {
      return orderAmount * tier.directCommissionRate;
    }

    // For residual commissions, use the first residual rate
    return orderAmount * (tier.residualCommissionRates[0] || 0);
  }

  /**
   * Calculate residual commission for a specific level
   */
  calculateResidualCommission(
    orderAmount: number,
    level: number,
    tier: CommissionTier
  ): number {
    const rate = tier.residualCommissionRates[level - 1] || 0;
    return orderAmount * rate;
  }

  /**
   * Check if user qualifies for bonuses
   */
  checkBonusEligibility(
    tier: CommissionTier,
    daysSinceJoining: number,
    personalVolume: number,
    teamVolume: number
  ): { eligibleBonuses: string[]; totalBonus: number } {
    const eligibleBonuses: string[] = [];
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
  getTierById(tierId: string): CommissionTier | undefined {
    return COMMISSION_TIERS.find(tier => tier.id === tierId);
  }

  /**
   * Get all available tiers
   */
  getAllTiers(): CommissionTier[] {
    return [...COMMISSION_TIERS];
  }

  /**
   * Validate if a tier configuration is valid
   */
  validateTier(tier: Partial<CommissionTier>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tier.id) errors.push('Tier ID is required');
    if (!tier.name) errors.push('Tier name is required');
    if (typeof tier.minSalesVolume !== 'number') errors.push('Minimum sales volume must be a number');
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
  logTierChange(userId: string, oldTier: string, newTier: string, reason: string) {
    logger.info('User tier changed', {
      userId,
      oldTier,
      newTier,
      reason,
      type: 'tier_change'
    });
  }

  logBonusAwarded(userId: string, bonusType: string, amount: number) {
    logger.info('Bonus awarded to user', {
      userId,
      bonusType,
      amount,
      type: 'bonus_awarded'
    });
  }
}

// Export singleton instance
export const commissionTierService = new CommissionTierService();
export default commissionTierService;