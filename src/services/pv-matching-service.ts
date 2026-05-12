/**
 * PV Matching Service for Binary MLM System
 * 
 * CORRECT LOGIC:
 * 1. Waiting PV is the SOURCE OF TRUTH for matching
 * 2. When new member joins → ADD their rank PV to sponsor's waiting leg
 * 3. Match = min(left waiting, right waiting)
 * 4. After match: Larger waiting = larger - smaller, Smaller waiting = 0
 * 5. Commission = min(left, right) × 8%
 * 
 * Member's user.pv field is their rank-based PV (never modified during matching)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CurrentPeriodVolume {
  leftPV: number;           // Live PV from left leg (G1 rank PV for display)
  rightPV: number;          // Live PV from right leg (G1 rank PV for display)
  leftWaitingPV: number;    // Waiting PV from left leg (SOURCE OF TRUTH)
  rightWaitingPV: number;   // Waiting PV from right leg (SOURCE OF TRUTH)
  leftTotalPV: number;      // Same as leftWaitingPV (for backward compatibility)
  rightTotalPV: number;     // Same as rightWaitingPV (for backward compatibility)
  matchedPV: number;        // PV matched today
  leftMembers: number;      // Count of members in left leg
  rightMembers: number;     // Count of members in right leg
  teamSize?: {              // Team size from database (auto-calculated)
    left: number;
    right: number;
    total: number;
  };
}

export interface PVMatchingResult {
  userId: string;
  date: Date;
  leftPV: number;
  rightPV: number;
  matchedPV: number;
  leftWaitingPV: number;
  rightWaitingPV: number;
  commissionEarned: number;
  matchCount: number;
}

export interface WaitingPVRecord {
  matchedPV: number;
}

export interface CommissionCalculation {
  userId: string;
  orderId: string;
  productId: string;
  commissionType: 'direct' | 'unilevel' | 'binary' | 'matrix' | 'matching' | 'leadership';
  level?: number;
  amount: number;
  percentage: number;
  volume: number; // PV/BV used for calculation
  eligible: boolean;
  reason?: string;
}

export interface CommissionResult {
  orderId: string;
  totalCommissions: number;
  commissions: CommissionCalculation[];
  processed: boolean;
}

// Rank PV values - MINIMUM PV for each rank (used as fallback if user.pv is not set)
// The actual PV used is user.pv field, NOT these fixed values
const RANK_PV: Record<string, number> = {
  'Member': 0,
  'Bronze': 100,
  'Silver': 100,
  'Gold': 500,       // Updated to match expected PV
  'Diamond': 1000,
  'Manager': 2000,
  'Director': 4000,
  'President': 8000,
  'Double President': 16000,
};

// Rank hierarchy for checking upgrades
const RANK_ORDER: string[] = [
  'Member',
  'Bronze',
  'Silver',
  'Gold',
  'Diamond',
  'Manager',
  'Director',
  'President',
  'Double President'
];

// ============================================================================
// PV Matching Service Class
// ============================================================================

export class PVMatchingService {
  // ============================================================================
  // ENHANCED MLM COMMISSION ENGINE INTEGRATION
  // ============================================================================

  /**
   * Enhanced commission calculation supporting multiple MLM compensation types
   * Integrated with database-driven commission rules and eligibility checking
   */
  static async calculateMLMCommissions(orderId: string): Promise<CommissionResult> {
    try {
      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true
            }
          },
          user: true
        }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const commissions: CommissionCalculation[] = [];
      let totalCommissions = 0;

      // Calculate direct commission for purchaser
      const directCommission = await this.calculateDirectCommission(order);
      if (directCommission) {
        commissions.push(directCommission);
        totalCommissions += directCommission.amount;
      }

      // Calculate upline commissions based on compensation rules
      const uplineCommissions = await this.calculateUplineCommissions(order);
      commissions.push(...uplineCommissions);
      totalCommissions += uplineCommissions.reduce((sum, c) => sum + c.amount, 0);

      // Calculate volume-based commissions (binary/matrix)
      const volumeCommissions = await this.calculateVolumeCommissions(order);
      commissions.push(...volumeCommissions);
      totalCommissions += volumeCommissions.reduce((sum, c) => sum + c.amount, 0);

      // Calculate leadership bonuses
      const leadershipBonuses = await this.calculateLeadershipBonuses(order);
      commissions.push(...leadershipBonuses);
      totalCommissions += leadershipBonuses.reduce((sum, c) => sum + c.amount, 0);

      const result: CommissionResult = {
        orderId,
        totalCommissions,
        commissions,
        processed: false
      };

      logger.info('Calculated MLM commissions with rules', {
        orderId,
        totalCommissions,
        commissionCount: commissions.length
      });

      return result;

    } catch (error) {
      logger.error('Error calculating MLM commissions:', error);
      throw error;
    }
  }

  /**
   * Calculate direct commission for purchaser using database rules
   */
  private static async calculateDirectCommission(order: any): Promise<CommissionCalculation | null> {
    try {
      // Get direct commission rule from database
      const directRule = await prisma.commissionRule.findFirst({
        where: {
          type: 'direct',
          isActive: true
        }
      });

      if (!directRule) {
        // Fallback to default if no rule exists
        const totalPV = order.items.reduce((sum: number, item: any) =>
          sum + (item.product.pv * item.quantity), 0);
        const amount = totalPV * 0.20;

        return {
          userId: order.userId,
          orderId: order.id,
          productId: order.items[0]?.productId || '',
          commissionType: 'direct',
          amount,
          percentage: 0.20,
          volume: totalPV,
          eligible: true
        };
      }

      const totalPV = order.items.reduce((sum: number, item: any) =>
        sum + (item.product.pv * item.quantity), 0);

      const amount = Math.min(
        totalPV * (directRule.percentage / 100),
        directRule.maxAmount || Infinity
      );

      return {
        userId: order.userId,
        orderId: order.id,
        productId: order.items[0]?.productId || '',
        commissionType: 'direct',
        amount,
        percentage: directRule.percentage,
        volume: totalPV,
        eligible: true
      };
    } catch (error) {
      logger.error('Error calculating direct commission:', error);
      return null;
    }
  }

  /**
   * Calculate upline commissions using database rules
   */
  private static async calculateUplineCommissions(order: any): Promise<CommissionCalculation[]> {
    const commissions: CommissionCalculation[] = [];
    const totalPV = order.items.reduce((sum: number, item: any) =>
      sum + (item.product.pv * item.quantity), 0);

    // Get genealogy path to root
    const genealogyPath = await this.getGenealogyPath(order.userId);
    const commissionRules = await prisma.commissionRule.findMany({
      where: {
        type: { in: ['unilevel', 'matrix'] },
        isActive: true
      },
      orderBy: { level: 'asc' }
    });

    for (let level = 1; level <= genealogyPath.length && level <= 10; level++) {
      const uplineUserId = genealogyPath[level - 1];
      if (!uplineUserId) break;

      // Find applicable rule for this level
      const rule = commissionRules.find(r => r.level === level);
      if (!rule) continue;

      // Check eligibility conditions
      const eligible = await this.checkEligibility(uplineUserId, rule.conditions);
      if (!eligible) continue;

      const amount = Math.min(
        totalPV * (rule.percentage / 100),
        rule.maxAmount || Infinity
      );

      commissions.push({
        userId: uplineUserId,
        orderId: order.id,
        productId: order.items[0]?.productId || '',
        commissionType: rule.type as any,
        level,
        amount,
        percentage: rule.percentage,
        volume: totalPV,
        eligible: true
      });
    }

    return commissions;
  }

  /**
   * Calculate binary/matrix volume commissions
   */
  private static async calculateVolumeCommissions(order: any): Promise<CommissionCalculation[]> {
    const commissions: CommissionCalculation[] = [];
    const totalPV = order.items.reduce((sum: number, item: any) =>
      sum + (item.product.pv * item.quantity), 0);

    // Get user's genealogy node
    const userNode = await prisma.genealogyTree.findUnique({
      where: { userId: order.userId }
    });

    if (!userNode) return commissions;

    // For binary systems, commissions are paid when one leg catches up to the other
    const binaryRules = await prisma.commissionRule.findMany({
      where: {
        type: 'binary',
        isActive: true
      }
    });

    // This is a simplified implementation
    // Real binary calculation would track weekly/monthly volumes
    for (const rule of binaryRules) {
      const eligible = await this.checkEligibility(order.userId, rule.conditions);
      if (eligible) {
        const amount = Math.min(
          totalPV * (rule.percentage / 100),
          rule.maxAmount || Infinity
        );
        commissions.push({
          userId: order.userId,
          orderId: order.id,
          productId: order.items[0]?.productId || '',
          commissionType: 'binary',
          amount,
          percentage: rule.percentage,
          volume: totalPV,
          eligible: true
        });
      }
    }

    return commissions;
  }

  /**
   * Calculate leadership bonuses for qualified leaders
   */
  private static async calculateLeadershipBonuses(order: any): Promise<CommissionCalculation[]> {
    const commissions: CommissionCalculation[] = [];
    const totalPV = order.items.reduce((sum: number, item: any) =>
      sum + (item.product.pv * item.quantity), 0);

    // Get genealogy path
    const genealogyPath = await this.getGenealogyPath(order.userId);

    const leadershipRules = await prisma.commissionRule.findMany({
      where: {
        type: 'leadership',
        isActive: true
      }
    });

    for (const rule of leadershipRules) {
      // Find qualified leaders in upline
      for (const uplineUserId of genealogyPath) {
        const eligible = await this.checkEligibility(uplineUserId, rule.conditions);
        if (eligible) {
          const amount = Math.min(
            totalPV * (rule.percentage / 100),
            rule.maxAmount || Infinity
          );
          commissions.push({
            userId: uplineUserId,
            orderId: order.id,
            productId: order.items[0]?.productId || '',
            commissionType: 'leadership',
            amount,
            percentage: rule.percentage,
            volume: totalPV,
            eligible: true
          });
          break; // Only first qualified leader gets this bonus
        }
      }
    }

    return commissions;
  }

  /**
   * Get genealogy path from user to root
   */
  private static async getGenealogyPath(userId: string): Promise<string[]> {
    const path: string[] = [];
    let currentId = userId;

    while (currentId) {
      const node = await prisma.genealogyTree.findUnique({
        where: { userId: currentId },
        select: { sponsorId: true }
      });

      if (!node?.sponsorId) break;

      path.push(node.sponsorId);
      currentId = node.sponsorId;
    }

    return path;
  }

  /**
   * Check if user meets commission eligibility conditions
   */
  private static async checkEligibility(userId: string, conditions: any): Promise<boolean> {
    if (!conditions) return true;

    try {
      // Check rank requirements
      if (conditions.minRank) {
        const userRank = await this.getUserRank(userId);
        if (userRank.level < conditions.minRank) return false;
      }

      // Check volume requirements
      if (conditions.minVolume) {
        const userVolume = await this.getUserVolume(userId);
        if (userVolume < conditions.minVolume) return false;
      }

      // Check downline requirements
      if (conditions.minDownline) {
        const downlineCount = await this.getDownlineCount(userId);
        if (downlineCount < conditions.minDownline) return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking eligibility:', error);
      return false;
    }
  }

  /**
   * Get user's current rank
   */
  private static async getUserRank(userId: string): Promise<{ name: string; level: number }> {
    // This would check rank advancement history
    // Simplified implementation
    const advancement = await prisma.rankAdvancement.findFirst({
      where: { userId },
      orderBy: { advancementDate: 'desc' },
      include: { toRank: true }
    });

    return advancement ? {
      name: advancement.toRank.name,
      level: advancement.toRank.level
    } : { name: 'Member', level: 1 };
  }

  /**
   * Get user's total volume
   */
  private static async getUserVolume(userId: string): Promise<number> {
    // Calculate from genealogy tree
    const node = await prisma.genealogyTree.findUnique({
      where: { userId },
      select: { totalVolume: true }
    });

    return node?.totalVolume || 0;
  }

  /**
   * Get downline count
   */
  private static async getDownlineCount(userId: string): Promise<number> {
    const node = await prisma.genealogyTree.findUnique({
      where: { userId },
      select: { totalDownline: true }
    });

    return node?.totalDownline || 0;
  }

  /**
   * Process and save calculated commissions
   */
  static async processCommissions(result: CommissionResult): Promise<void> {
    try {
      for (const commission of result.commissions) {
        await prisma.commission.create({
          data: {
            userId: commission.userId,
            type: commission.commissionType,
            description: `Commission for order ${result.orderId}`,
            amount: commission.amount,
            metadata: {
              orderId: commission.orderId,
              productId: commission.productId,
              percentage: commission.percentage,
              volume: commission.volume,
              level: commission.level,
              eligible: commission.eligible
            }
          }
        });
      }

      // Mark as processed
      result.processed = true;

      logger.info('Processed commissions for order', {
        orderId: result.orderId,
        commissionCount: result.commissions.length,
        totalAmount: result.totalCommissions
      });

    } catch (error) {
      logger.error('Error processing commissions:', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Get rank PV value for a rank
  // --------------------------------------------------------------------------
  static getRankPV(rank: string): number {
    return RANK_PV[rank] || 0;
  }
  
  // --------------------------------------------------------------------------
  // CORE: Get member's PV from user.pv field (their rank-based PV)
  // This is their personal PV contribution, NOT modified during matching
  // --------------------------------------------------------------------------
  static async getMemberPV(userId: string): Promise<number> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId, deleted: false, active: true },
        select: { pv: true, rank: true }
      });

      const memberPV = Number(user?.pv) || 0;

      if (memberPV > 0) {
        logger.debug('Member PV retrieved', { userId, pv: memberPV, rank: user?.rank });
      }

      return memberPV;
    } catch (error) {
      logger.error('Error getting member PV', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return 0;
    }
  }

  // --------------------------------------------------------------------------
  // Get waiting PV from database columns (SOURCE OF TRUTH)
  // --------------------------------------------------------------------------
  static async getWaitingPV(userId: string): Promise<{
    leftWaitingPV: number;
    rightWaitingPV: number;
  }> {
    try {
      // Try to fetch using Prisma's type-safe query first
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { leftWaitingPV: true, rightWaitingPV: true } as any,
        });

        if (user) {
          return {
            leftWaitingPV: typeof user.leftWaitingPV === 'number' ? user.leftWaitingPV : 0,
            rightWaitingPV: typeof user.rightWaitingPV === 'number' ? user.rightWaitingPV : 0,
          };
        }
      } catch (prismaError: any) {
        // If columns don't exist, fall back to raw query with error handling
        const errorMessage = prismaError?.message || '';
        if (
          errorMessage.includes('Unknown column') ||
          errorMessage.includes('column') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('P2001')
        ) {
          // Columns don't exist, return defaults
          logger.warn('Waiting PV columns do not exist, using defaults', { userId });
          return { leftWaitingPV: 0, rightWaitingPV: 0 };
        }
        // For other Prisma errors, try raw query as fallback
      }

      // Fallback to raw query if Prisma select fails
      try {
        const result = await prisma.$queryRaw<Array<{ leftWaitingPV: number; rightWaitingPV: number }>>`
          SELECT "leftWaitingPV", "rightWaitingPV" FROM "users" WHERE "id" = ${userId}
        `;

        if (!result || result.length === 0) {
          return { leftWaitingPV: 0, rightWaitingPV: 0 };
        }

        return {
          leftWaitingPV: Number(result[0].leftWaitingPV) || 0,
          rightWaitingPV: Number(result[0].rightWaitingPV) || 0
        };
      } catch (rawError: any) {
        // If raw query also fails (columns don't exist), return defaults
        const errorMessage = rawError?.message || '';
        if (
          errorMessage.includes('Unknown column') ||
          errorMessage.includes('column') ||
          errorMessage.includes('does not exist')
        ) {
          logger.warn('Waiting PV columns do not exist in database, using defaults', { userId });
          return { leftWaitingPV: 0, rightWaitingPV: 0 };
        }
        throw rawError; // Re-throw if it's a different error
      }
    } catch (error) {
      logger.error('Error fetching waiting PV', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return { leftWaitingPV: 0, rightWaitingPV: 0 };
    }
  }

  // Alias for backward compatibility
  static async getCarryForwardWaitingPV(userId: string): Promise<{
    leftWaitingPV: number;
    rightWaitingPV: number;
  }> {
    return this.getWaitingPV(userId);
  }

  // --------------------------------------------------------------------------
  // Atomically add PV to one waiting leg (avoids race when both legs topped up)
  // Use this in handlePVChange so concurrent top-ups to ADM005 and ADM006 both count
  // --------------------------------------------------------------------------
  static async addToWaitingLeg(
    userId: string,
    leg: 'left' | 'right',
    amount: number
  ): Promise<void> {
    if (amount <= 0) return;
    try {
      if (leg === 'left') {
        await prisma.$executeRaw`
          UPDATE "users"
          SET "leftWaitingPV" = COALESCE("leftWaitingPV", 0) + ${amount},
              "updatedAt" = NOW()
          WHERE "id" = ${userId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE "users"
          SET "rightWaitingPV" = COALESCE("rightWaitingPV", 0) + ${amount},
              "updatedAt" = NOW()
          WHERE "id" = ${userId}
        `;
      }
      logger.debug('Added PV to waiting leg (atomic)', { userId, leg, amount });
    } catch (error) {
      logger.error('Error in addToWaitingLeg', {
        userId,
        leg,
        amount,
        error: error instanceof Error ? error.message : 'Unknown'
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Update waiting PV in database
  // --------------------------------------------------------------------------
  static async updateWaitingPV(
    userId: string, 
    leftWaitingPV: number, 
    rightWaitingPV: number
  ): Promise<void> {
    try {
      // Try to update using Prisma's type-safe update first
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            leftWaitingPV: leftWaitingPV as any,
            rightWaitingPV: rightWaitingPV as any,
          } as any,
      });

        logger.debug('Waiting PV updated', {
          userId,
          leftWaitingPV,
          rightWaitingPV
        });
        return;
      } catch (prismaError: any) {
        // If columns don't exist, log warning and skip update
        const errorMessage = prismaError?.message || '';
        if (
          errorMessage.includes('Unknown column') ||
          errorMessage.includes('column') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('P2001')
        ) {
          logger.warn('Waiting PV columns do not exist, skipping update', {
            userId,
            leftWaitingPV,
            rightWaitingPV
          });
          return;
        }
        // For other Prisma errors, try raw query as fallback
      }

      // Fallback to raw query if Prisma update fails
      try {
        // Update waiting PV and timestamps
        // Set timestamp to NOW() when PV is added, keep existing timestamp when PV is reduced
        await prisma.$executeRaw`
          UPDATE "users" 
          SET 
            "leftWaitingPV" = ${leftWaitingPV},
              "rightWaitingPV" = ${rightWaitingPV},
            "leftWaitingPVCreatedAt" = CASE 
              WHEN ${leftWaitingPV} > COALESCE("leftWaitingPV", 0) THEN NOW()
              WHEN ${leftWaitingPV} = 0 THEN NULL
              ELSE COALESCE("leftWaitingPVCreatedAt", NOW())
            END,
            "rightWaitingPVCreatedAt" = CASE 
              WHEN ${rightWaitingPV} > COALESCE("rightWaitingPV", 0) THEN NOW()
              WHEN ${rightWaitingPV} = 0 THEN NULL
              ELSE COALESCE("rightWaitingPVCreatedAt", NOW())
            END,
              "updatedAt" = NOW()
          WHERE "id" = ${userId}
        `;

        logger.debug('Waiting PV updated via raw query', {
          userId,
          leftWaitingPV,
          rightWaitingPV
        });
      } catch (rawError: any) {
        // If raw query also fails (columns don't exist), log warning
        const errorMessage = rawError?.message || '';
        if (
          errorMessage.includes('Unknown column') ||
          errorMessage.includes('column') ||
          errorMessage.includes('does not exist')
        ) {
          logger.warn('Waiting PV columns do not exist in database, skipping update', {
            userId,
            leftWaitingPV,
            rightWaitingPV
          });
          return;
        }
        throw rawError; // Re-throw if it's a different error
      }
    } catch (error) {
      logger.error('Error updating waiting PV', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      // Don't throw - allow system to continue even if update fails
    }
  }

  // --------------------------------------------------------------------------
  // ADD NEW MEMBER PV TO SPONSOR'S WAITING LEG
  // Called when a new member joins - adds their rank PV to sponsor's waiting
  // --------------------------------------------------------------------------
  static async addNewMemberPVToSponsor(
    newMemberId: string,
    sponsorId: string,
    position: 'left' | 'right',
    memberPV: number
  ): Promise<void> {
    try {
      if (memberPV <= 0) {
        logger.debug('No PV to add (member PV is 0)', { newMemberId, sponsorId, position });
        return;
      }

      // Get current waiting PV
      const currentWaiting = await this.getWaitingPV(sponsorId);

      // Add new member's PV to the appropriate leg
      const newLeftWaitingPV = position === 'left' 
        ? currentWaiting.leftWaitingPV + memberPV 
        : currentWaiting.leftWaitingPV;
      
      const newRightWaitingPV = position === 'right' 
        ? currentWaiting.rightWaitingPV + memberPV 
        : currentWaiting.rightWaitingPV;

      // Update waiting PV
      await this.updateWaitingPV(sponsorId, newLeftWaitingPV, newRightWaitingPV);

      logger.info('Added new member PV to sponsor waiting', {
        newMemberId,
        sponsorId,
        position,
        memberPV,
        previousLeft: currentWaiting.leftWaitingPV,
        previousRight: currentWaiting.rightWaitingPV,
        newLeft: newLeftWaitingPV,
        newRight: newRightWaitingPV
      });
    } catch (error) {
      logger.error('Error adding new member PV to sponsor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        newMemberId,
        sponsorId,
        position,
        memberPV
      });
    }
  }

  // --------------------------------------------------------------------------
  // Get TODAY's matched PV from pv_match_transactions (SOURCE OF TRUTH)
  // Uses actual matched_pv per run; includes all matches even when daily cap reached.
  // --------------------------------------------------------------------------
  static async getTodayMatchedPVFromTransactions(userId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const rows = await prisma.$queryRaw<Array<{ matched_pv: unknown }>>`
        SELECT COALESCE(SUM(matched_pv), 0) AS matched_pv
        FROM pv_match_transactions
        WHERE user_id = ${userId}
          AND created_at >= ${today}
          AND created_at < ${tomorrow}
      `;
      const matchedPV = Number(rows[0]?.matched_pv ?? 0) || 0;
      return matchedPV;
    } catch (error) {
      logger.warn('Error fetching today matched PV from transactions, falling back to commissions', {
        error: error instanceof Error ? error.message : 'Unknown',
        userId
      });
      const fallback = await this.getTodayWaitingPV(userId);
      return fallback?.matchedPV ?? 0;
    }
  }

  // --------------------------------------------------------------------------
  // Get TODAY's matched PV from commission records (fallback)
  // Commission = matched PV × 8%, so matched PV = amount / 0.08
  // --------------------------------------------------------------------------
  static async getTodayWaitingPV(userId: string): Promise<{ matchedPV: number } | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayCommissions = await prisma.commission.findMany({
        where: {
          userId,
          type: 'Daily Match',
          date: { gte: today, lt: tomorrow }
        },
        select: { amount: true }
      });

      const matchedPV = todayCommissions.reduce((sum, c) => {
        const amt = Number(c.amount) || 0;
        return sum + (amt / 0.08); // matched PV = amount / 8%
      }, 0);

      return matchedPV > 0 ? { matchedPV } : null;
    } catch (error) {
      logger.error('Error fetching today matched PV from commissions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Count members in a leg (recursive)
  // --------------------------------------------------------------------------
  static async countLegMembers(
    rootUserId: string,
    position: 'left' | 'right'
  ): Promise<number> {
    const directChild = await prisma.user.findFirst({
      where: {
        placementParentId: rootUserId,
        position: position,
        deleted: false,
        active: true
      },
      select: { id: true }
    });

    if (!directChild) {
      return 0;
    }

    const countSubtree = async (userId: string, visited: Set<string>): Promise<number> => {
      if (visited.has(userId)) return 0;
      visited.add(userId);

      let count = 1; // Count this member

      const children = await prisma.user.findMany({
        where: {
          placementParentId: userId,
          deleted: false,
          active: true
        },
        select: { id: true }
      });

      for (const child of children) {
        count += await countSubtree(child.id, visited);
      }

      return count;
    };

    return await countSubtree(directChild.id, new Set());
  }

  // --------------------------------------------------------------------------
  // Get G1 children info for display
  // --------------------------------------------------------------------------
  static async getG1ChildrenInfo(userId: string): Promise<{
    leftG1PV: number;
    rightG1PV: number;
    leftG1Rank: string | null;
    rightG1Rank: string | null;
  }> {
    const [leftChild, rightChild] = await Promise.all([
      prisma.user.findFirst({
        where: {
          placementParentId: userId,
          position: 'left',
          deleted: false,
          active: true
        },
        select: { pv: true, rank: true }
      }),
      prisma.user.findFirst({
        where: {
          placementParentId: userId,
          position: 'right',
          deleted: false,
          active: true
        },
        select: { pv: true, rank: true }
      })
    ]);

    return {
      leftG1PV: Number(leftChild?.pv) || 0,
      rightG1PV: Number(rightChild?.pv) || 0,
      leftG1Rank: leftChild?.rank || null,
      rightG1Rank: rightChild?.rank || null
    };
  }

  // --------------------------------------------------------------------------
  // MAIN: Get current period volume for display in UI
  // Waiting PV is the SOURCE OF TRUTH
  // --------------------------------------------------------------------------
  static async getCurrentPeriodVolume(userId: string): Promise<CurrentPeriodVolume> {
    try {
      logger.info('🔍 Getting current period volume', { userId });

      // 1. Get waiting PV from database (SOURCE OF TRUTH)
      const waitingPV = await this.getWaitingPV(userId);

      // 2. Get G1 children info for display
      const g1Info = await this.getG1ChildrenInfo(userId);
      
      // 3. Count members in each leg
      const [leftMembers, rightMembers] = await Promise.all([
        this.countLegMembers(userId, 'left'),
        this.countLegMembers(userId, 'right')
      ]);

      // 4. Get today's matched PV (from pv_match_transactions; includes all matches, even when cap reached)
      const matchedPVToday = await this.getTodayMatchedPVFromTransactions(userId);

      // 5. Use live-calculated team size (not stale database value)
      const liveTeamSize = {
        left: leftMembers,
        right: rightMembers,
        total: leftMembers + rightMembers
      };

      const result: CurrentPeriodVolume = {
        leftPV: g1Info.leftG1PV,                          // G1 left PV for display
        rightPV: g1Info.rightG1PV,                        // G1 right PV for display
        leftWaitingPV: waitingPV.leftWaitingPV,           // SOURCE OF TRUTH
        rightWaitingPV: waitingPV.rightWaitingPV,         // SOURCE OF TRUTH
        leftTotalPV: waitingPV.leftWaitingPV,             // Same as waiting (for compatibility)
        rightTotalPV: waitingPV.rightWaitingPV,           // Same as waiting (for compatibility)
        matchedPV: matchedPVToday,
        leftMembers,
        rightMembers,
        teamSize: liveTeamSize                             // Live-calculated, not stale
      };

      logger.info('Current Period Volume calculated', {
        userId,
        leftWaitingPV: waitingPV.leftWaitingPV,
        rightWaitingPV: waitingPV.rightWaitingPV,
        leftG1PV: g1Info.leftG1PV,
        rightG1PV: g1Info.rightG1PV,
        matchedToday: matchedPVToday
      });

      return result;
    } catch (error) {
      logger.error('Error calculating current period volume', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return {
        leftPV: 0,
        rightPV: 0,
        leftWaitingPV: 0,
        rightWaitingPV: 0,
        leftTotalPV: 0,
        rightTotalPV: 0,
        matchedPV: 0,
        leftMembers: 0,
        rightMembers: 0,
        teamSize: { left: 0, right: 0, total: 0 }
      };
    }
  }

  // --------------------------------------------------------------------------
  // CORE: Perform daily PV matching for a specific member
  // Uses waiting PV as source of truth
  // Commission = min(left, right) × 8%
  // After match: larger waiting = larger - smaller, smaller = 0
  // --------------------------------------------------------------------------
  static async performDailyMatching(
    userId: string,
    options: {
      triggerType?: 'manual' | 'auto' | 'new_member_join';
      triggerMemberId?: string;
    } = {}
  ): Promise<PVMatchingResult> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Get waiting PV (SOURCE OF TRUTH)
    const waitingPV = await this.getWaitingPV(userId);
    const leftWaitingPV = waitingPV.leftWaitingPV;
    const rightWaitingPV = waitingPV.rightWaitingPV;

    // 2. Calculate matched PV = min(left waiting, right waiting)
    const matchedPV = Math.min(leftWaitingPV, rightWaitingPV);

    // 3. Calculate new waiting PV after matching
    // The matched PV is "consumed" from both sides
    // Larger leg keeps the difference, smaller leg becomes 0
    let leftAfterMatch: number;
    let rightAfterMatch: number;

    if (leftWaitingPV > rightWaitingPV) {
      // Left is larger: left keeps difference, right becomes 0
      leftAfterMatch = leftWaitingPV - rightWaitingPV;
      rightAfterMatch = 0;
    } else if (rightWaitingPV > leftWaitingPV) {
      // Right is larger: right keeps difference, left becomes 0
      leftAfterMatch = 0;
      rightAfterMatch = rightWaitingPV - leftWaitingPV;
    } else {
      // Equal: both become 0
      leftAfterMatch = 0;
      rightAfterMatch = 0;
    }

    // 4. Get commission rate from settings (with user/company context)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true }
    });

    const { SettingsService } = await import('@/services/settings/settings-service');
    const commissionRate = await SettingsService.getCommissionRate({
      companyId: user?.companyId,
      userId
    });

    // 5. Calculate commission (rate from settings)
    const commissionEarned = matchedPV * commissionRate;

    // 5. Update waiting PV in database
    await this.updateWaitingPV(userId, leftAfterMatch, rightAfterMatch);

    // 6. Record the match transaction
    await this.recordMatchTransaction(userId, {
      leftPVUsed: Math.min(leftWaitingPV, matchedPV),
      rightPVUsed: Math.min(rightWaitingPV, matchedPV),
      matchedPV,
      leftWaitingAfter: leftAfterMatch,
      rightWaitingAfter: rightAfterMatch,
      commissionRate,
      commissionEarned,
      triggerType: options.triggerType || 'manual',
      triggerMemberId: options.triggerMemberId
    });

    logger.info('Daily matching performed', {
      userId,
      leftBefore: leftWaitingPV,
      rightBefore: rightWaitingPV,
      matchedPV,
      commissionEarned,
      leftAfter: leftAfterMatch,
      rightAfter: rightAfterMatch,
      triggerType: options.triggerType
    });

    return {
      userId,
      date: today,
      leftPV: leftWaitingPV,
      rightPV: rightWaitingPV,
      matchedPV,
      leftWaitingPV: leftAfterMatch,
      rightWaitingPV: rightAfterMatch,
      commissionEarned,
      matchCount: 1
    };
  }

  // --------------------------------------------------------------------------
  // Save waiting PV record (backward compatibility wrapper)
  // --------------------------------------------------------------------------
  static async saveWaitingPVRecord(
    userId: string,
    dateStr: string,
    data: {
      leftLivePV: number;
      rightLivePV: number;
      leftWaitingPV: number;
      rightWaitingPV: number;
      leftTotalPV: number;
      rightTotalPV: number;
      matchedPV: number;
      commissionEarned: number;
    }
  ): Promise<void> {
    // Just update the waiting PV columns
    await this.updateWaitingPV(userId, data.leftWaitingPV, data.rightWaitingPV);
  }

  // --------------------------------------------------------------------------
  // Record match transaction (history)
  // --------------------------------------------------------------------------
  static async recordMatchTransaction(
    userId: string,
    data: {
      leftPVUsed: number;
      rightPVUsed: number;
      matchedPV: number;
      leftWaitingAfter: number;
      rightWaitingAfter: number;
      commissionRate: number;
      commissionEarned: number;
      triggerType: string;
      triggerMemberId?: string;
      memberRank?: string;
      dailyCapMatches?: number;
      matchesUsed?: number;
    }
  ): Promise<void> {
    try {
      // Get member rank if not provided
      let rank = data.memberRank;
      if (!rank) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { rank: true }
        });
        rank = user?.rank || 'Unknown';
      }

      await prisma.$executeRaw`
        INSERT INTO pv_match_transactions (
          user_id,
          left_pv_used,
          right_pv_used,
          matched_pv,
          left_waiting_after,
          right_waiting_after,
          commission_rate,
          commission_earned,
          member_rank,
          daily_cap_matches,
          matches_used,
          trigger_type,
          trigger_member_id,
          created_at
        )
        VALUES (
          ${userId},
          ${data.leftPVUsed},
          ${data.rightPVUsed},
          ${data.matchedPV},
          ${data.leftWaitingAfter},
          ${data.rightWaitingAfter},
          ${data.commissionRate},
          ${data.commissionEarned},
          ${rank},
          ${data.dailyCapMatches || null},
          ${data.matchesUsed || null},
          ${data.triggerType},
          ${data.triggerMemberId || null},
          NOW()
        )
      `;

      logger.debug('Match transaction recorded', { userId, ...data });
    } catch (error) {
      // Don't fail if transaction recording fails
      logger.warn('Failed to record match transaction', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
    }
  }

  // --------------------------------------------------------------------------
  // Calculate and update teamSize for a user
  // --------------------------------------------------------------------------
  static async updateTeamSize(userId: string): Promise<void> {
    try {
      const [leftCount, rightCount] = await Promise.all([
        this.countLegMembers(userId, 'left'),
        this.countLegMembers(userId, 'right')
      ]);

      const teamSize = {
        left: leftCount,
        right: rightCount,
        total: leftCount + rightCount
      };

      await prisma.user.update({
        where: { id: userId },
        data: { teamSize }
      });

      logger.debug('Team size updated', { userId, teamSize });
    } catch (error) {
      logger.error('Error updating team size', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
    }
  }

  // --------------------------------------------------------------------------
  // UPLINE CASCADE: Get all upline sponsors (for cascade recalculation)
  // --------------------------------------------------------------------------
  static async getAllUplineSponsors(userId: string): Promise<string[]> {
    const uplineSponsors: string[] = [];
    const visited = new Set<string>();
    let currentUserId = userId;

    while (true) {
      if (visited.has(currentUserId)) {
        break;
      }
      visited.add(currentUserId);

      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { placementParentId: true, position: true }
      });

      if (!user?.placementParentId) {
        break;
      }

      uplineSponsors.push(user.placementParentId);
      currentUserId = user.placementParentId;
    }

    return uplineSponsors;
  }

  // --------------------------------------------------------------------------
  // Get member's position relative to a sponsor
  // --------------------------------------------------------------------------
  static async getMemberLegPosition(
    memberId: string,
    sponsorId: string
  ): Promise<'left' | 'right' | null> {
    let currentId = memberId;
    const visited = new Set<string>();

    while (currentId !== sponsorId) {
      if (visited.has(currentId)) {
        return null;
      }
      visited.add(currentId);

      const user = await prisma.user.findUnique({
        where: { id: currentId },
        select: { placementParentId: true, position: true }
      });

      if (!user?.placementParentId) {
        return null;
      }

      if (user.placementParentId === sponsorId) {
        return user.position as 'left' | 'right';
      }

      currentId = user.placementParentId;
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // HANDLE PV CHANGE: Called when an existing member's PV is updated (topup/transfer)
  // Calculates the PV difference and adds it to ALL upline sponsors' waiting leg
  // --------------------------------------------------------------------------
  static async handlePVChange(
    memberId: string,
    oldPV: number,
    newPV: number
  ): Promise<void> {
    try {
      const pvDifference = newPV - oldPV;
      
      if (pvDifference <= 0) {
        logger.debug('No PV increase, skipping upline update', { memberId, oldPV, newPV });
        return;
      }

      logger.info('Handling PV change - adding difference to upline sponsors', {
        memberId,
        oldPV,
        newPV,
        pvDifference
      });

      // Get all upline sponsors
      const uplineSponsors = await this.getAllUplineSponsors(memberId);

      // For each upline sponsor, add the PV difference to their waiting leg
      for (const sponsorId of uplineSponsors) {
        try {
          // Determine which leg the member is in
          const legPosition = await this.getMemberLegPosition(memberId, sponsorId);
          
          if (!legPosition) {
            continue;
          }

          // Atomically add PV to this leg (avoids race when both legs topped up at once)
          await this.addToWaitingLeg(sponsorId, legPosition, pvDifference);

          // Read current totals after add (for logging and daily match check)
          const currentWaiting = await this.getWaitingPV(sponsorId);

          logger.info('Added PV difference to sponsor waiting leg', {
            memberId,
            sponsorId,
            legPosition,
            pvDifference,
            leftWaitingPV: currentWaiting.leftWaitingPV,
            rightWaitingPV: currentWaiting.rightWaitingPV
          });

          // Check if sponsor now qualifies for auto daily match
          if (currentWaiting.leftWaitingPV > 0 && currentWaiting.rightWaitingPV > 0) {
            const { checkAndTriggerDailyMatch } = await import('./daily-match-trigger');
            await checkAndTriggerDailyMatch(sponsorId);
          }
        } catch (error) {
          logger.error('Error processing upline sponsor for PV change', {
            sponsorId,
            memberId,
            error: error instanceof Error ? error.message : 'Unknown'
          });
        }
      }

    } catch (error) {
      logger.error('Error handling PV change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        memberId,
        oldPV,
        newPV
      });
    }
  }

  // --------------------------------------------------------------------------
  // TRIGGER: Called when a new member joins
  // Adds new member's PV to ALL upline sponsors' waiting leg
  // Then checks if any sponsor qualifies for auto daily match
  // --------------------------------------------------------------------------
  static async triggerUplineRecalculation(
    newMemberId: string,
    newMemberPV: number
  ): Promise<void> {
    try {
      if (newMemberPV <= 0) {
        logger.debug('No PV to add to upline (member PV is 0)', { newMemberId });
        return;
      }

      // Get all upline sponsors
      const uplineSponsors = await this.getAllUplineSponsors(newMemberId);

      logger.info('Triggering upline PV addition for new member', {
        newMemberId,
        newMemberPV,
        uplineCount: uplineSponsors.length,
        uplineSponsors: uplineSponsors.slice(0, 5)
      });

      // For each upline sponsor, add the new member's PV to their waiting leg
      for (const sponsorId of uplineSponsors) {
        try {
          // Determine which leg the new member is in
          const legPosition = await this.getMemberLegPosition(newMemberId, sponsorId);
          
          if (!legPosition) {
            continue;
          }

          // Add new member's PV to sponsor's waiting leg
          await this.addNewMemberPVToSponsor(newMemberId, sponsorId, legPosition, newMemberPV);

          // Check if sponsor now qualifies for auto daily match
          const waitingPV = await this.getWaitingPV(sponsorId);
          
          if (waitingPV.leftWaitingPV > 0 && waitingPV.rightWaitingPV > 0) {
            // Sponsor may be eligible for daily match - trigger check
            const { checkAndTriggerDailyMatch } = await import('./daily-match-trigger');
            await checkAndTriggerDailyMatch(sponsorId);
          }
        } catch (error) {
          logger.error('Error processing upline sponsor', {
            sponsorId,
            newMemberId,
            error: error instanceof Error ? error.message : 'Unknown'
          });
        }
      }

      // Update team sizes for all upline sponsors
      await this.updateUplineTeamSizes(newMemberId);

    } catch (error) {
      logger.error('Error in upline recalculation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        newMemberId
      });
    }
  }

  // --------------------------------------------------------------------------
  // Update teamSize for all upline sponsors
  // --------------------------------------------------------------------------
  static async updateUplineTeamSizes(newMemberId: string): Promise<void> {
    try {
      const uplineSponsors = await this.getAllUplineSponsors(newMemberId);
      
      await Promise.all(
        uplineSponsors.map(sponsorId => this.updateTeamSize(sponsorId))
      );

      logger.debug('Upline team sizes updated', {
        newMemberId,
        uplineCount: uplineSponsors.length
      });
    } catch (error) {
      logger.error('Error updating upline team sizes', {
        error: error instanceof Error ? error.message : 'Unknown error',
        newMemberId
      });
    }
  }

  // --------------------------------------------------------------------------
  // HANDLE RANK CHANGE: Called when a member's rank is upgraded
  // Adds the rank PV to all upline sponsors' waiting legs
  // --------------------------------------------------------------------------
  static async handleRankChange(
    memberId: string,
    oldRank: string | null,
    newRank: string
  ): Promise<void> {
    try {
      const oldRankIndex = RANK_ORDER.indexOf(oldRank || 'Member');
      const newRankIndex = RANK_ORDER.indexOf(newRank);

      // Only process if it's an upgrade (new rank is higher than old rank)
      if (newRankIndex <= oldRankIndex) {
        logger.debug('Not a rank upgrade, skipping PV addition', {
          memberId,
          oldRank,
          newRank
        });
        return;
      }

      // Get the member's actual PV from user.pv field (NOT the fixed RANK_PV)
      const member = await prisma.user.findUnique({
        where: { id: memberId },
        select: { pv: true }
      });

      const memberPV = Number(member?.pv) || 0;

      if (memberPV <= 0) {
        // Fallback to RANK_PV if user.pv is not set
        const fallbackPV = RANK_PV[newRank] || 0;
        if (fallbackPV <= 0) {
          logger.debug('Member has no PV and rank has no fallback PV', { memberId, newRank });
          return;
        }
        
        logger.info('Using fallback RANK_PV since user.pv is 0', {
          memberId,
          newRank,
          fallbackPV
        });
        
        await this.triggerUplineRecalculation(memberId, fallbackPV);
        return;
      }

      // Only add PV if upgrading FROM Member TO a real rank
      // This prevents adding PV multiple times for subsequent rank upgrades
      if (oldRank && oldRank !== 'Member') {
        logger.debug('Already had a rank, not adding additional PV', {
          memberId,
          oldRank,
          newRank
        });
        return;
      }

      logger.info('Rank upgraded - adding member PV to upline sponsors', {
        memberId,
        oldRank,
        newRank,
        memberPV  // Using actual user.pv
      });

      // Use the triggerUplineRecalculation to add PV to all upline sponsors
      await this.triggerUplineRecalculation(memberId, memberPV);

    } catch (error) {
      logger.error('Error handling rank change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        memberId,
        oldRank,
        newRank
      });
    }
  }

  // --------------------------------------------------------------------------
  // Legacy: Calculate leg PV recursively (kept for backward compatibility)
  // Note: This is NOT used for matching anymore, only for display/debugging
  // --------------------------------------------------------------------------
  static async calculateLegPV(
    rootUserId: string,
    position: 'left' | 'right',
    visited: Set<string> = new Set()
  ): Promise<number> {
    if (visited.has(`${rootUserId}-${position}`)) {
      return 0;
  }
    visited.add(`${rootUserId}-${position}`);

    const directChild = await prisma.user.findFirst({
      where: {
        placementParentId: rootUserId,
        position: position,
        deleted: false,
        active: true
      },
      select: { id: true, pv: true, rank: true }
    });

    if (!directChild) {
      return 0;
    }

    let totalPV = Number(directChild.pv) || 0;

    const addDescendantsPV = async (userId: string, visitedIds: Set<string>): Promise<number> => {
      if (visitedIds.has(userId)) {
        return 0;
      }
      visitedIds.add(userId);

      let descendantsPV = 0;

      const children = await prisma.user.findMany({
        where: {
          placementParentId: userId,
          deleted: false,
          active: true
        },
        select: { id: true, pv: true, memberId: true }
      });

      for (const child of children) {
        const childPV = Number(child.pv) || 0;
        descendantsPV += childPV;
        const deeperPV = await addDescendantsPV(child.id, visitedIds);
        descendantsPV += deeperPV;
      }

      return descendantsPV;
    };

    const descendantsPV = await addDescendantsPV(directChild.id, new Set([directChild.id]));
    totalPV += descendantsPV;

    return totalPV;
  }

  // --------------------------------------------------------------------------
  // Legacy compatibility: saveWaitingPV
  // --------------------------------------------------------------------------
  static async saveWaitingPV(
    userId: string,
    date: Date,
    leftWaitingPV: number,
    rightWaitingPV: number,
    matchedPV: number
  ): Promise<void> {
    await this.updateWaitingPV(userId, leftWaitingPV, rightWaitingPV);
  }
}
