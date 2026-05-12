/**
 * HIGH PRIORITY FIX #8: Rank Maintenance & Demotion Service
 * 
 * In MLM systems, members must maintain certain requirements each period
 * to keep their rank. If requirements are not met, they are demoted.
 * 
 * Typical Requirements:
 * - Personal Volume (PV)
 * - Team Volume (TV)
 * - Active downlines
 * - Personal sales
 * 
 * This service:
 * 1. Checks rank requirements periodically (monthly)
 * 2. Demotes members who don't meet requirements
 * 3. Promotes members who qualify for higher rank
 * 4. Logs all rank changes for audit trail
 */

import { prisma } from '@/lib/prisma';

export interface RankRequirements {
  rank: string;
  personalVolume: number;        // Minimum PV per period
  teamVolume: number;            // Minimum total team volume
  activeDownlines: number;       // Minimum active team members
  personalSales: number;         // Minimum personal orders
  leftLegVolume?: number;        // For binary plans
  rightLegVolume?: number;       // For binary plans
  directReferrals?: number;      // Minimum direct sponsors
  threeMonthSales?: number;      // Minimum sales in 3 months (for Diamond → Manager)
}

export interface RankChangeResult {
  userId: string;
  memberId: string;
  oldRank: string;
  newRank: string;
  reason: string;
  qualified: boolean;
}

/**
 * Default rank requirements for binary MLM
 * Can be customized per company
 */
const DEFAULT_RANK_REQUIREMENTS: Record<string, RankRequirements> = {
  'Member': {
    rank: 'Member',
    personalVolume: 0,
    teamVolume: 0,
    activeDownlines: 0,
    personalSales: 0
  },
  'Bronze': {
    rank: 'Bronze',
    personalVolume: 60,
    teamVolume: 300,
    activeDownlines: 1,
    personalSales: 1,
    directReferrals: 1
  },
  'Silver': {
    rank: 'Silver',
    personalVolume: 100,
    teamVolume: 500,
    activeDownlines: 2,
    personalSales: 1,
    directReferrals: 2
  },
  'Gold': {
    rank: 'Gold',
    personalVolume: 500,
    teamVolume: 2000,
    activeDownlines: 5,
    personalSales: 2,
    directReferrals: 3,
    leftLegVolume: 800,
    rightLegVolume: 800
  },
  'Platinum': {
    rank: 'Platinum',
    personalVolume: 500,
    teamVolume: 5000,
    activeDownlines: 10,
    personalSales: 3,
    directReferrals: 5,
    leftLegVolume: 2000,
    rightLegVolume: 2000
  },
  'Diamond': {
    rank: 'Diamond',
    personalVolume: 1000,
    teamVolume: 15000,
    activeDownlines: 20,
    personalSales: 5,
    directReferrals: 8,
    leftLegVolume: 5000,
    rightLegVolume: 5000
  },
  'Manager': {
    rank: 'Manager',
    personalVolume: 1000,  // Same as Diamond
    teamVolume: 30000,
    activeDownlines: 30,
    personalSales: 8,
    directReferrals: 10,
    leftLegVolume: 10000,
    rightLegVolume: 10000,
    threeMonthSales: 3000  // Special requirement: $3000 commission in 3 months
  },
  'Director': {
    rank: 'Director',
    personalVolume: 1000,  // Same as Manager and Diamond
    teamVolume: 50000,
    activeDownlines: 50,
    personalSales: 10,
    directReferrals: 12,
    leftLegVolume: 15000,
    rightLegVolume: 15000,
    threeMonthSales: 15000  // Special requirement: $15000 commission in 3 months
  },
  'President': {
    rank: 'President',
    personalVolume: 1000,  // Same as Diamond, Manager, and Director
    teamVolume: 60000,
    activeDownlines: 60,
    personalSales: 12,
    directReferrals: 15,
    leftLegVolume: 20000,
    rightLegVolume: 20000,
    threeMonthSales: 30000  // Special requirement: $30000 commission in 3 months
  },
  'Double President': {
    rank: 'Double President',
    personalVolume: 1000,  // Same as Diamond, Manager, Director, and President
    teamVolume: 100000,
    activeDownlines: 100,
    personalSales: 20,
    directReferrals: 25,
    leftLegVolume: 50000,
    rightLegVolume: 50000,
    threeMonthSales: 150000  // Special requirement: $150000 commission in 3 months
  },
  'Executive': {
    rank: 'Executive',
    personalVolume: 2000,
    teamVolume: 50000,
    activeDownlines: 50,
    personalSales: 10,
    directReferrals: 12,
    leftLegVolume: 15000,
    rightLegVolume: 15000
  }
};

const RANK_HIERARCHY = ['Member', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Manager', 'Director', 'President', 'Double President', 'Executive'];

export class RankMaintenanceService {
  /**
   * Run monthly rank maintenance for all users
   * Should be executed via cron job at month end
   */
  static async performMonthlyRankMaintenance(
    companyId?: string
  ): Promise<RankChangeResult[]> {
    console.log('Starting monthly rank maintenance...');
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(0); // Last day of previous month
    endDate.setHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: {
        active: true,
        deleted: false,
        rank: { not: 'Member' }, // Only check ranked members
        ...(companyId && { companyId })
      },
      select: {
        id: true,
        memberId: true,
        rank: true,
        pv: true,
        companyId: true
      }
    });

    console.log(`Checking rank requirements for ${users.length} members`);

    const results: RankChangeResult[] = [];

    for (const user of users) {
      try {
        const result = await this.checkAndUpdateUserRank(
          user.id,
          startDate,
          endDate
        );
        
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Failed to check rank for user ${user.memberId}:`, error);
      }
    }

    console.log(`Rank maintenance complete. ${results.length} rank changes made.`);
    
    return results;
  }

  /**
   * Check if user meets rank requirements and update if needed
   */
  static async checkAndUpdateUserRank(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<RankChangeResult | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        memberId: true,
        rank: true,
        pv: true,
        companyId: true
      }
    });

    if (!user || user.rank === 'Member') {
      return null;
    }

    // Calculate user's performance metrics
    const metrics = await this.calculateUserMetrics(userId, periodStart, periodEnd);

    // Get rank requirements
    const requirements = this.getRankRequirements(user.rank, user.companyId || undefined);

    // Check if user qualifies for current rank
    const meetsRequirements = this.meetsRankRequirements(metrics, requirements);

    if (meetsRequirements) {
      // Check if user qualifies for promotion
      const higherRank = this.getNextRank(user.rank);
      if (higherRank) {
        const higherRequirements = this.getRankRequirements(higherRank, user.companyId || undefined);
        const meetsHigherRequirements = this.meetsRankRequirements(metrics, higherRequirements);
        
        // Special check for Diamond → Manager: requires $3000 in 3 months
        if (user.rank === 'Diamond' && higherRank === 'Manager') {
          const threeMonthSales = await this.calculateThreeMonthSales(userId, periodEnd);
          if (threeMonthSales < 3000) {
            return null; // Don't promote - hasn't met 3-month requirement
          }
        }
        
        // Special check for Manager → Director: requires $15000 in 3 months
        if (user.rank === 'Manager' && higherRank === 'Director') {
          const threeMonthSales = await this.calculateThreeMonthSales(userId, periodEnd);
          if (threeMonthSales < 15000) {
            return null; // Don't promote - hasn't met 3-month requirement
          }
        }
        
        // Special check for Director → President: requires $30000 in 3 months
        if (user.rank === 'Director' && higherRank === 'President') {
          const threeMonthSales = await this.calculateThreeMonthSales(userId, periodEnd);
          if (threeMonthSales < 30000) {
            return null; // Don't promote - hasn't met 3-month requirement
          }
        }
        
        // Special check for President → Double President: requires $150000 in 3 months
        if (user.rank === 'President' && higherRank === 'Double President') {
          const threeMonthSales = await this.calculateThreeMonthSales(userId, periodEnd);
          if (threeMonthSales < 150000) {
            return null; // Don't promote - hasn't met 3-month requirement
          }
        }
        
        if (meetsHigherRequirements) {
          return await this.updateUserRank(
            userId,
            higherRank,
            `Promoted: Met all requirements for ${higherRank}`,
            true
          );
        }
      }
      
      // Maintains current rank
      return null;
    } else {
      // User does NOT meet requirements - demote
      const lowerRank = this.getLowerRank(user.rank);
      return await this.updateUserRank(
        userId,
        lowerRank,
        `Demoted: Did not meet ${user.rank} requirements`,
        false
      );
    }
  }

  /**
   * Calculate user's performance metrics for the period
   */
  private static async calculateUserMetrics(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    personalVolume: number;
    teamVolume: number;
    activeDownlines: number;
    personalSales: number;
    leftLegVolume: number;
    rightLegVolume: number;
    directReferrals: number;
  }> {
    // Personal Volume (PV) from orders
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: 'completed',
        createdAt: { gte: periodStart, lte: periodEnd }
      },
      select: { totalAmount: true }
    });

    const personalVolume = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const personalSales = orders.length;

    // Get user's downline tree
    const downlineUsers = await this.getDownlineUsers(userId);

    // Team Volume (sum of all downline orders)
    const teamOrders = await prisma.order.findMany({
      where: {
        userId: { in: downlineUsers.map(u => u.id) },
        status: 'completed',
        createdAt: { gte: periodStart, lte: periodEnd }
      },
      select: { totalAmount: true, userId: true }
    });

    const teamVolume = teamOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Active downlines (members with at least 1 order this period)
    const activeUserIds = new Set(teamOrders.map(o => o.userId));
    const activeDownlines = activeUserIds.size;

    // Binary leg volumes
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    const leftLegUsers = downlineUsers.filter(u => {
      // Simplified: Check if user is in left subtree
      // In production, use proper genealogy traversal
      return this.isInLeftLeg(u.id, userId);
    });

    const rightLegUsers = downlineUsers.filter(u => {
      return this.isInRightLeg(u.id, userId);
    });

    const leftLegVolume = teamOrders
      .filter(o => leftLegUsers.some(u => u.id === o.userId))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const rightLegVolume = teamOrders
      .filter(o => rightLegUsers.some(u => u.id === o.userId))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Direct referrals
    const directReferrals = await prisma.user.count({
      where: {
        sponsorId: userId,
        active: true,
        deleted: false
      }
    });

    return {
      personalVolume,
      teamVolume,
      activeDownlines,
      personalSales,
      leftLegVolume,
      rightLegVolume,
      directReferrals
    };
  }

  /**
   * Calculate total commission/match earnings in the last 3 months
   * For Diamond → Manager promotion requirement: $3000 from commissions
   */
  private static async calculateThreeMonthSales(
    userId: string,
    endDate: Date
  ): Promise<number> {
    const threeMonthsAgo = new Date(endDate);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get all paid commissions in the last 3 months
    // This includes daily match bonuses, binary commissions, and other commission types
    const commissions = await prisma.commission.findMany({
      where: {
        userId,
        status: 'Paid',
        date: {
          gte: threeMonthsAgo,
          lte: endDate
        }
      },
      select: { amount: true }
    });

    // Sum all commission amounts
    return commissions.reduce((sum, commission) => sum + (commission.amount || 0), 0);
  }

  /**
   * Check if metrics meet rank requirements
   */
  private static meetsRankRequirements(
    metrics: any,
    requirements: RankRequirements
  ): boolean {
    if (metrics.personalVolume < requirements.personalVolume) return false;
    if (metrics.teamVolume < requirements.teamVolume) return false;
    if (metrics.activeDownlines < requirements.activeDownlines) return false;
    if (metrics.personalSales < requirements.personalSales) return false;
    
    if (requirements.leftLegVolume && metrics.leftLegVolume < requirements.leftLegVolume) {
      return false;
    }
    
    if (requirements.rightLegVolume && metrics.rightLegVolume < requirements.rightLegVolume) {
      return false;
    }
    
    if (requirements.directReferrals && metrics.directReferrals < requirements.directReferrals) {
      return false;
    }

    return true;
  }

  /**
   * Update user's rank in database
   */
  private static async updateUserRank(
    userId: string,
    newRank: string,
    reason: string,
    qualified: boolean
  ): Promise<RankChangeResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, memberId: true, rank: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const oldRank = user.rank;

    // Update rank in transaction
    await prisma.$transaction(async (tx) => {
      // Update user rank
      await tx.user.update({
        where: { id: userId },
        data: { rank: newRank }
      });

      // Log rank change
      await tx.auditLog.create({
        data: {
          userId,
          action: qualified ? 'rank_promoted' : 'rank_demoted',
          entity: 'user',
          changes: {
            oldRank,
            newRank,
            reason,
            timestamp: new Date()
          },
          ipAddress: 'system',
          userAgent: 'rank-maintenance-service'
        }
      });

      // Create notification for user
      // TODO: Implement notification service
      console.log(`Rank changed for ${user.memberId}: ${oldRank} -> ${newRank}. Reason: ${reason}`);
    });

    return {
      userId,
      memberId: user.memberId,
      oldRank,
      newRank,
      reason,
      qualified
    };
  }

  /**
   * Get rank requirements (can be customized per company)
   */
  private static getRankRequirements(
    rank: string,
    companyId?: string
  ): RankRequirements {
    // TODO: Fetch from company-specific configuration if exists
    // For now, use default requirements
    return DEFAULT_RANK_REQUIREMENTS[rank] || DEFAULT_RANK_REQUIREMENTS['Member'];
  }

  /**
   * Get all downline users for a user
   */
  private static async getDownlineUsers(userId: string): Promise<Array<{ id: string }>> {
    // Recursive query to get all downline members
    const downline = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE downline AS (
        -- Base case: direct children
        SELECT id, placement_parent_id
        FROM users
        WHERE placement_parent_id = ${userId}
          AND deleted = false
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT u.id, u.placement_parent_id
        FROM users u
        INNER JOIN downline d ON u.placement_parent_id = d.id
        WHERE u.deleted = false
      )
      SELECT id FROM downline
    `;

    return downline;
  }

  /**
   * Check if user is in left leg of parent
   */
  private static async isInLeftLeg(userId: string, parentId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { position: true, placementParentId: true }
    });

    if (!user) return false;

    // Direct child in left position
    if (user.placementParentId === parentId && user.position === 'left') {
      return true;
    }

    // Check if any parent in the chain is left of target parent
    if (user.placementParentId) {
      return this.isInLeftLeg(user.placementParentId, parentId);
    }

    return false;
  }

  /**
   * Check if user is in right leg of parent
   */
  private static async isInRightLeg(userId: string, parentId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { position: true, placementParentId: true }
    });

    if (!user) return false;

    // Direct child in right position
    if (user.placementParentId === parentId && user.position === 'right') {
      return true;
    }

    // Check if any parent in the chain is right of target parent
    if (user.placementParentId) {
      return this.isInRightLeg(user.placementParentId, parentId);
    }

    return false;
  }

  /**
   * Get next higher rank in hierarchy
   */
  private static getNextRank(currentRank: string): string | null {
    const currentIndex = RANK_HIERARCHY.indexOf(currentRank);
    if (currentIndex === -1 || currentIndex === RANK_HIERARCHY.length - 1) {
      return null; // Already at highest rank
    }
    return RANK_HIERARCHY[currentIndex + 1];
  }

  /**
   * Get next lower rank in hierarchy
   */
  private static getLowerRank(currentRank: string): string {
    const currentIndex = RANK_HIERARCHY.indexOf(currentRank);
    if (currentIndex === -1 || currentIndex === 0) {
      return 'Member'; // Default to Member
    }
    return RANK_HIERARCHY[currentIndex - 1];
  }

  /**
   * Manual rank adjustment (admin function)
   * Use with caution - bypasses requirements check
   */
  static async adminAdjustRank(
    userId: string,
    newRank: string,
    reason: string,
    adminId: string
  ): Promise<RankChangeResult> {
    if (!RANK_HIERARCHY.includes(newRank)) {
      throw new Error(`Invalid rank: ${newRank}`);
    }

    return await this.updateUserRank(
      userId,
      newRank,
      `Admin adjustment: ${reason} (by admin ${adminId})`,
      true
    );
  }

  /**
   * Get rank statistics for company
   */
  static async getRankStatistics(companyId?: string): Promise<Record<string, number>> {
    const users = await prisma.user.groupBy({
      by: ['rank'],
      where: {
        active: true,
        deleted: false,
        ...(companyId && { companyId })
      },
      _count: { rank: true }
    });

    const stats: Record<string, number> = {};
    for (const rank of RANK_HIERARCHY) {
      stats[rank] = 0;
    }

    for (const item of users) {
      stats[item.rank] = item._count.rank;
    }

    return stats;
  }

  /**
   * Preview rank changes before executing
   * Useful for testing and reporting
   */
  static async previewRankChanges(
    companyId?: string
  ): Promise<RankChangeResult[]> {
    // Same logic as performMonthlyRankMaintenance but without saving
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: {
        active: true,
        deleted: false,
        rank: { not: 'Member' },
        ...(companyId && { companyId })
      },
      select: {
        id: true,
        memberId: true,
        rank: true
      }
    });

    const results: RankChangeResult[] = [];

    for (const user of users) {
      const metrics = await this.calculateUserMetrics(user.id, startDate, endDate);
      const requirements = this.getRankRequirements(user.rank, companyId);
      const meetsRequirements = this.meetsRankRequirements(metrics, requirements);

      if (!meetsRequirements) {
        const lowerRank = this.getLowerRank(user.rank);
        results.push({
          userId: user.id,
          memberId: user.memberId,
          oldRank: user.rank,
          newRank: lowerRank,
          reason: 'Would be demoted: Requirements not met',
          qualified: false
        });
      } else {
        const higherRank = this.getNextRank(user.rank);
        if (higherRank) {
          const higherRequirements = this.getRankRequirements(higherRank, companyId);
          if (this.meetsRankRequirements(metrics, higherRequirements)) {
            results.push({
              userId: user.id,
              memberId: user.memberId,
              oldRank: user.rank,
              newRank: higherRank,
              reason: 'Would be promoted: Meets higher rank requirements',
              qualified: true
            });
          }
        }
      }
    }

    return results;
  }
}
