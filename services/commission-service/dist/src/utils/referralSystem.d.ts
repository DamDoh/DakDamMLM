import { CommissionTier } from './commissionTiers';
export interface ReferralRecord {
    id: string;
    referrerId: string;
    referredId: string;
    referralDate: Date;
    status: 'pending' | 'active' | 'inactive';
    commissionEarned: number;
    level: number;
    source: 'direct' | 'genealogy' | 'promotion';
}
export interface ReferralStats {
    totalReferrals: number;
    activeReferrals: number;
    totalCommissionEarned: number;
    averageCommissionPerReferral: number;
    referralLevels: {
        level: number;
        count: number;
        commissionEarned: number;
    }[];
    recentReferrals: ReferralRecord[];
}
export interface ReferralCommission {
    referrerId: string;
    referredId: string;
    orderId: string;
    amount: number;
    level: number;
    tier: CommissionTier;
    commissionRate: number;
    calculatedCommission: number;
}
export declare class ReferralSystemService {
    /**
     * Record a new referral relationship
     */
    recordReferral(referrerId: string, referredId: string, source?: 'direct' | 'genealogy' | 'promotion'): Promise<ReferralRecord>;
    /**
     * Calculate the referral level (direct = 1, indirect = 2, etc.)
     */
    private calculateReferralLevel;
    /**
     * Find the referral path in genealogy
     */
    private findReferralPath;
    /**
     * Calculate commission for a referral-based sale
     */
    calculateReferralCommission(referrerId: string, referredId: string, orderId: string, orderAmount: number): Promise<ReferralCommission | null>;
    /**
     * Get commission rate based on referral level and user tier
     */
    private getReferralCommissionRate;
    /**
     * Record commission earned from referral
     */
    recordReferralCommission(referrerId: string, referredId: string, orderId: string, commissionAmount: number): Promise<void>;
    /**
     * Get referral statistics for a user
     */
    getReferralStats(userId: string): Promise<ReferralStats>;
    /**
     * Get referrer statistics (used for tier calculation)
     */
    private getReferrerStats;
    /**
     * Update referral status
     */
    updateReferralStatus(referrerId: string, referredId: string, status: 'pending' | 'active' | 'inactive'): Promise<void>;
    /**
     * Get referral network for a user
     */
    getReferralNetwork(userId: string, maxDepth?: number): Promise<any>;
    private buildReferralNetwork;
    /**
     * Process referral bonuses and rewards
     */
    processReferralBonuses(userId: string): Promise<void>;
}
export declare const referralSystemService: ReferralSystemService;
export default referralSystemService;
//# sourceMappingURL=referralSystem.d.ts.map