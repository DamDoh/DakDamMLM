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
export declare const COMMISSION_TIERS: CommissionTier[];
export declare class CommissionTierService {
    /**
     * Get the appropriate commission tier based on user's sales volume and requirements
     */
    getUserTier(personalVolume: number, teamVolume: number, directReferrals: number): CommissionTier;
    /**
     * Get comprehensive tier information for a user
     */
    getUserTierInfo(personalVolume: number, teamVolume: number, directReferrals: number): UserTierInfo;
    /**
     * Calculate commission amount based on user's tier
     */
    calculateCommissionWithTier(orderAmount: number, tier: CommissionTier, isDirectSale?: boolean): number;
    /**
     * Calculate residual commission for a specific level
     */
    calculateResidualCommission(orderAmount: number, level: number, tier: CommissionTier): number;
    /**
     * Check if user qualifies for bonuses
     */
    checkBonusEligibility(tier: CommissionTier, daysSinceJoining: number, personalVolume: number, teamVolume: number): {
        eligibleBonuses: string[];
        totalBonus: number;
    };
    /**
     * Get tier by ID
     */
    getTierById(tierId: string): CommissionTier | undefined;
    /**
     * Get all available tiers
     */
    getAllTiers(): CommissionTier[];
    /**
     * Validate if a tier configuration is valid
     */
    validateTier(tier: Partial<CommissionTier>): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Log tier-related events
     */
    logTierChange(userId: string, oldTier: string, newTier: string, reason: string): void;
    logBonusAwarded(userId: string, bonusType: string, amount: number): void;
}
export declare const commissionTierService: CommissionTierService;
export default commissionTierService;
//# sourceMappingURL=commissionTiers.d.ts.map