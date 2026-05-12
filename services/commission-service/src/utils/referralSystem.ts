import { commissionDb } from '../config/database';
import { logger } from './logger';
import { commissionTierService, CommissionTier } from './commissionTiers';

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredId: string;
  referralDate: Date;
  status: 'pending' | 'active' | 'inactive';
  commissionEarned: number;
  level: number; // 1 = direct, 2 = indirect, etc.
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

export class ReferralSystemService {
  /**
   * Record a new referral relationship
   */
  async recordReferral(
    referrerId: string,
    referredId: string,
    source: 'direct' | 'genealogy' | 'promotion' = 'direct'
  ): Promise<ReferralRecord> {
    try {
      // Check if referral already exists
      const existingReferral = await (commissionDb as any).referral.findFirst({
        where: {
          referrerId,
          referredId,
        },
      });

      if (existingReferral) {
        logger.warn('Referral already exists', { referrerId, referredId });
        return existingReferral as ReferralRecord;
      }

      // Determine referral level (direct vs indirect)
      const level = await this.calculateReferralLevel(referrerId, referredId);

      const referral = await (commissionDb as any).referral.create({
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

      logger.info('New referral recorded', {
        referralId: referral.id,
        referrerId,
        referredId,
        level,
        source,
        type: 'referral_created'
      });

      return referral as ReferralRecord;
    } catch (error) {
      logger.error('Failed to record referral', {
        referrerId,
        referredId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Calculate the referral level (direct = 1, indirect = 2, etc.)
   */
  private async calculateReferralLevel(referrerId: string, referredId: string): Promise<number> {
    try {
      // Check if referrer is the direct sponsor
      const directReferral = await commissionDb.user.findFirst({
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

    } catch (error) {
      logger.error('Failed to calculate referral level', {
        referrerId,
        referredId,
        error: (error as Error).message
      });
      return 1; // Default to direct referral
    }
  }

  /**
   * Find the referral path in genealogy
   */
  private async findReferralPath(referrerId: string, referredId: string): Promise<string[]> {
    const path: string[] = [];
    let currentUserId = referredId;

    // Traverse up the genealogy tree
    while (currentUserId) {
      const user = await commissionDb.user.findUnique({
        where: { id: currentUserId },
        select: { sponsorId: true },
      });

      if (!user?.sponsorId) break;

      if (user.sponsorId === referrerId) {
        // Found the referrer in the upline
        return path;
      }

      path.push(user.sponsorId);
      currentUserId = user.sponsorId;

      // Prevent infinite loops (max 10 levels)
      if (path.length > 10) break;
    }

    return [];
  }

  /**
   * Calculate commission for a referral-based sale
   */
  async calculateReferralCommission(
    referrerId: string,
    referredId: string,
    orderId: string,
    orderAmount: number
  ): Promise<ReferralCommission | null> {
    try {
      // Get referral relationship
      const referral = await (commissionDb as any).referral.findFirst({
        where: {
          referrerId,
          referredId,
          status: 'active',
        },
      });

      if (!referral) {
        logger.debug('No active referral found', { referrerId, referredId });
        return null;
      }

      // Get referrer's tier information
      const referrerStats = await this.getReferrerStats(referrerId);
      const tier = commissionTierService.getUserTier(
        referrerStats.personalVolume,
        referrerStats.teamVolume,
        referrerStats.directReferrals
      );

      // Calculate commission based on referral level and tier
      const commissionRate = this.getReferralCommissionRate(referral.level, tier);
      const calculatedCommission = orderAmount * commissionRate;

      const referralCommission: ReferralCommission = {
        referrerId,
        referredId,
        orderId,
        amount: orderAmount,
        level: referral.level,
        tier,
        commissionRate,
        calculatedCommission,
      };

      logger.info('Referral commission calculated', {
        referrerId,
        referredId,
        orderId,
        level: referral.level,
        commissionRate,
        calculatedCommission,
        type: 'referral_commission_calculated'
      });

      return referralCommission;
    } catch (error) {
      logger.error('Failed to calculate referral commission', {
        referrerId,
        referredId,
        orderId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get commission rate based on referral level and user tier
   */
  private getReferralCommissionRate(level: number, tier: CommissionTier): number {
    // Use residual commission rates for referral commissions
    const rateIndex = Math.min(level - 1, tier.residualCommissionRates.length - 1);
    return tier.residualCommissionRates[rateIndex] || 0;
  }

  /**
   * Record commission earned from referral
   */
  async recordReferralCommission(
    referrerId: string,
    referredId: string,
    orderId: string,
    commissionAmount: number
  ): Promise<void> {
    try {
      // Update referral record
      await (commissionDb as any).referral.updateMany({
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
      await commissionDb.commission.create({
        data: {
          userId: referrerId,
          orderId: orderId || undefined,
          amount: commissionAmount,
          percentage: 0, // Percentage not available in this context
          type: 'DIRECT' as any, // Using DIRECT as referral type
          status: 'PENDING' as any,
          level: 1,
        } as any,
      });

      logger.info('Referral commission recorded', {
        referrerId,
        referredId,
        orderId,
        commissionAmount,
        type: 'referral_commission_recorded'
      });
    } catch (error) {
      logger.error('Failed to record referral commission', {
        referrerId,
        referredId,
        orderId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<ReferralStats> {
    try {
      const referrals = await (commissionDb as any).referral.findMany({
        where: { referrerId: userId },
        orderBy: { referralDate: 'desc' },
        take: 10, // Recent referrals
      });

      const totalReferrals = await (commissionDb as any).referral.count({
        where: { referrerId: userId },
      });

      const activeReferrals = await (commissionDb as any).referral.count({
        where: {
          referrerId: userId,
          status: 'active',
        },
      });

      const totalCommissionResult = await (commissionDb as any).referral.aggregate({
        where: { referrerId: userId },
        _sum: { commissionEarned: true },
      });

      const totalCommissionEarned = totalCommissionResult._sum.commissionEarned || 0;
      const averageCommissionPerReferral = totalReferrals > 0 ? totalCommissionEarned / totalReferrals : 0;

      // Group by referral levels
      const levelStats = await (commissionDb as any).referral.groupBy({
        by: ['level'],
        where: { referrerId: userId },
        _count: { id: true },
        _sum: { commissionEarned: true },
      });

      const referralLevels = levelStats.map((stat: typeof levelStats[number]) => ({
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
        recentReferrals: referrals as ReferralRecord[],
      };
    } catch (error) {
      logger.error('Failed to get referral stats', {
        userId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get referrer statistics (used for tier calculation)
   */
  private async getReferrerStats(userId: string): Promise<{
    personalVolume: number;
    teamVolume: number;
    directReferrals: number;
  }> {
    try {
      // Get personal volume (commissions earned)
      const personalVolumeResult = await commissionDb.commission.aggregate({
        where: { userId },
        _sum: { amount: true },
      });

      // Get team volume (from referrals)
      const teamVolumeResult = await (commissionDb as any).referral.aggregate({
        where: { referrerId: userId },
        _sum: { commissionEarned: true },
      });

      // Get direct referrals count
      const directReferrals = await (commissionDb as any).referral.count({
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
    } catch (error) {
      logger.error('Failed to get referrer stats', {
        userId,
        error: (error as Error).message
      });
      return { personalVolume: 0, teamVolume: 0, directReferrals: 0 };
    }
  }

  /**
   * Update referral status
   */
  async updateReferralStatus(
    referrerId: string,
    referredId: string,
    status: 'pending' | 'active' | 'inactive'
  ): Promise<void> {
    try {
      await (commissionDb as any).referral.updateMany({
        where: {
          referrerId,
          referredId,
        },
        data: { status },
      });

      logger.info('Referral status updated', {
        referrerId,
        referredId,
        status,
        type: 'referral_status_updated'
      });
    } catch (error) {
      logger.error('Failed to update referral status', {
        referrerId,
        referredId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get referral network for a user
   */
  async getReferralNetwork(userId: string, maxDepth: number = 3): Promise<any> {
    try {
      const network = await this.buildReferralNetwork(userId, maxDepth, 0);
      return network;
    } catch (error) {
      logger.error('Failed to get referral network', {
        userId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async buildReferralNetwork(
    userId: string,
    maxDepth: number,
    currentDepth: number
  ): Promise<any> {
    if (currentDepth >= maxDepth) return null;

    const referrals = await (commissionDb as any).referral.findMany({
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
      referrals: [] as any[],
    };

    for (const referral of referrals) {
      const subNetwork = await this.buildReferralNetwork(
        referral.referredId,
        maxDepth,
        currentDepth + 1
      );

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
  async processReferralBonuses(userId: string): Promise<void> {
    try {
      const stats = await this.getReferralStats(userId);

      // Check for milestone bonuses
      if (stats.totalReferrals >= 10 && stats.totalReferrals % 10 === 0) {
        logger.info('Referral milestone reached', {
          userId,
          totalReferrals: stats.totalReferrals,
          type: 'referral_milestone'
        });
        // Could trigger bonus commission or reward here
      }

      // Check for high-performing referral periods
      const recentReferrals = stats.recentReferrals.filter(
        ref => new Date(ref.referralDate).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
      );

      if (recentReferrals.length >= 5) {
        logger.info('High referral activity detected', {
          userId,
          recentReferrals: recentReferrals.length,
          type: 'referral_activity_spike'
        });
      }
    } catch (error) {
      logger.error('Failed to process referral bonuses', {
        userId,
        error: (error as Error).message
      });
    }
  }
}

// Export singleton instance
export const referralSystemService = new ReferralSystemService();
export default referralSystemService;