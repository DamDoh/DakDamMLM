import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface BonusPoolCalculation {
  userId: string;
  poolId: string;
  amount: number;
  rank: string;
  reason: string;
  calculation: {
    baseAmount: number;
    multiplier: number;
    adjustments: any[];
  };
}

export class BonusPoolEngine {
  /**
   * Calculate and distribute bonus pool for a period
   */
  static async processBonusPool(poolId: string): Promise<BonusPoolCalculation[]> {
    try {
      const pool = await prisma.bonusPool.findUnique({
        where: { id: poolId },
        include: { poolDistributions: true }
      });

      if (!pool) {
        throw new Error('Bonus pool not found');
      }

      if (pool.status !== 'active') {
        throw new Error('Bonus pool is not active');
      }

      const calculations: BonusPoolCalculation[] = [];

      // Get eligible participants based on pool rules
      const eligibleUsers = await this.getEligibleUsers(pool);

      // Calculate distributions based on pool type
      switch (pool.type) {
        case 'leadership':
          calculations.push(...await this.calculateLeadershipPool(pool, eligibleUsers));
          break;
        case 'performance':
          calculations.push(...await this.calculatePerformancePool(pool, eligibleUsers));
          break;
        case 'global':
          calculations.push(...await this.calculateGlobalPool(pool, eligibleUsers));
          break;
        default:
          throw new Error(`Unknown pool type: ${pool.type}`);
      }

      // Save distributions
      for (const calc of calculations) {
        await prisma.poolDistribution.create({
          data: {
            poolId: calc.poolId,
            userId: calc.userId,
            amount: calc.amount,
            rank: calc.rank,
            distributionDate: new Date()
          }
        });
      }

      // Update pool status
      await prisma.bonusPool.update({
        where: { id: poolId },
        data: {
          status: 'completed',
          distributed: calculations.reduce((sum, c) => sum + c.amount, 0)
        }
      });

      logger.info('Processed bonus pool', {
        poolId,
        poolName: pool.name,
        distributionCount: calculations.length,
        totalDistributed: calculations.reduce((sum, c) => sum + c.amount, 0)
      });

      return calculations;

    } catch (error) {
      logger.error('Error processing bonus pool:', error);
      throw error;
    }
  }

  /**
   * Get eligible users for bonus pool
   */
  private static async getEligibleUsers(pool: any): Promise<any[]> {
    // Get users based on pool criteria
    const rules = pool.distributionRules || {};

    const where: any = {
      active: true
    };

    // Add rank-based filtering
    if (rules.minRank) {
      // This would need to join with rank advancement
      // Simplified for this example
    }

    // Add volume-based filtering
    if (rules.minVolume) {
      // Filter users by volume requirements
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        genealogyTree: true,
        rankAdvancements: {
          orderBy: { advancementDate: 'desc' },
          take: 1,
          include: { toRank: true }
        }
      }
    });

    return users;
  }

  /**
   * Calculate leadership pool distribution
   */
  private static async calculateLeadershipPool(pool: any, users: any[]): Promise<BonusPoolCalculation[]> {
    const calculations: BonusPoolCalculation[] = [];

    // Sort users by leadership metrics (downline size, volume, rank)
    const sortedUsers = users
      .filter(u => u.genealogyTree?.totalDownline >= 10) // Minimum downline requirement
      .sort((a, b) => (b.genealogyTree?.totalDownline || 0) - (a.genealogyTree?.totalDownline || 0))
      .slice(0, 10); // Top 10 leaders

    const sharePerUser = pool.totalAmount / sortedUsers.length;

    for (const user of sortedUsers) {
      const rank = user.rankAdvancements[0]?.toRank?.name || 'Member';

      calculations.push({
        userId: user.id,
        poolId: pool.id,
        amount: sharePerUser,
        rank,
        reason: `Leadership pool distribution - ${user.genealogyTree?.totalDownline || 0} downline members`,
        calculation: {
          baseAmount: pool.totalAmount,
          multiplier: 1 / sortedUsers.length,
          adjustments: []
        }
      });
    }

    return calculations;
  }

  /**
   * Calculate performance pool distribution
   */
  private static async calculatePerformancePool(pool: any, users: any[]): Promise<BonusPoolCalculation[]> {
    const calculations: BonusPoolCalculation[] = [];

    // Calculate performance scores
    const userScores = await Promise.all(
      users.map(async (user) => {
        const score = await this.calculatePerformanceScore(user);
        return { user, score };
      })
    );

    // Sort by performance score
    const sortedUsers = userScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20 performers

    const totalScore = sortedUsers.reduce((sum, u) => sum + u.score, 0);

    for (const { user, score } of sortedUsers) {
      const amount = (score / totalScore) * pool.totalAmount;
      const rank = user.rankAdvancements[0]?.toRank?.name || 'Member';

      calculations.push({
        userId: user.id,
        poolId: pool.id,
        amount,
        rank,
        reason: `Performance pool distribution - score: ${score}`,
        calculation: {
          baseAmount: pool.totalAmount,
          multiplier: score / totalScore,
          adjustments: []
        }
      });
    }

    return calculations;
  }

  /**
   * Calculate global pool distribution (equal shares)
   */
  private static async calculateGlobalPool(pool: any, users: any[]): Promise<BonusPoolCalculation[]> {
    const calculations: BonusPoolCalculation[] = [];

    const eligibleUsers = users.filter(u =>
      (u.genealogyTree?.totalVolume || 0) >= 1000 // Minimum volume requirement
    );

    const sharePerUser = pool.totalAmount / eligibleUsers.length;

    for (const user of eligibleUsers) {
      const rank = user.rankAdvancements[0]?.toRank?.name || 'Member';

      calculations.push({
        userId: user.id,
        poolId: pool.id,
        amount: sharePerUser,
        rank,
        reason: 'Global pool distribution - equal share',
        calculation: {
          baseAmount: pool.totalAmount,
          multiplier: 1 / eligibleUsers.length,
          adjustments: []
        }
      });
    }

    return calculations;
  }

  /**
   * Calculate performance score for user
   */
  private static async calculatePerformanceScore(user: any): Promise<number> {
    let score = 0;

    // Volume contribution (40%)
    score += (user.genealogyTree?.totalVolume || 0) * 0.4;

    // Downline growth (30%)
    score += (user.genealogyTree?.totalDownline || 0) * 10 * 0.3;

    // Rank achievement (20%)
    const rankLevel = user.rankAdvancements[0]?.toRank?.level || 1;
    score += rankLevel * 100 * 0.2;

    // Recency bonus (10%) - more recent activity gets higher score
    const lastOrder = await prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (lastOrder) {
      const daysSinceLastOrder = (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 30 - daysSinceLastOrder) / 30; // 30-day window
      score += recencyScore * 1000 * 0.1;
    }

    return score;
  }

  /**
   * Create new bonus pool
   */
  static async createBonusPool(data: {
    name: string;
    type: 'leadership' | 'performance' | 'global';
    totalAmount: number;
    periodStart: Date;
    periodEnd: Date;
    distributionRules?: any;
  }): Promise<any> {
    try {
      const pool = await prisma.bonusPool.create({
        data: {
          name: data.name,
          type: data.type,
          totalAmount: data.totalAmount,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          distributionRules: data.distributionRules || {}
        }
      });

      logger.info('Created bonus pool', {
        poolId: pool.id,
        name: data.name,
        type: data.type,
        amount: data.totalAmount
      });

      return pool;
    } catch (error) {
      logger.error('Error creating bonus pool:', error);
      throw error;
    }
  }
}

export class ContestEngine {
  /**
   * Create a new contest
   */
  static async createContest(data: {
    name: string;
    description?: string;
    type: 'recruitment' | 'volume' | 'rank_advancement';
    startDate: Date;
    endDate: Date;
    rules: any;
    prizes: any;
  }): Promise<any> {
    try {
      const contest = await prisma.contest.create({
        data
      });

      logger.info('Created contest', {
        contestId: contest.id,
        name: data.name,
        type: data.type
      });

      return contest;
    } catch (error) {
      logger.error('Error creating contest:', error);
      throw error;
    }
  }

  /**
   * Process contest completion and distribute prizes
   */
  static async processContestResults(contestId: string): Promise<void> {
    try {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        include: {
          participants: {
            include: { user: true },
            orderBy: { currentScore: 'desc' }
          }
        }
      });

      if (!contest) {
        throw new Error('Contest not found');
      }

      if (contest.status !== 'active' || new Date() < contest.endDate) {
        throw new Error('Contest is not ready for processing');
      }

      // Update contest status
      await prisma.contest.update({
        where: { id: contestId },
        data: { status: 'completed' }
      });

      // Distribute prizes to top participants
      const prizes = contest.prizes || {};
      const maxPrizes = Math.min(contest.participants.length, Object.keys(prizes).length);

      for (let i = 0; i < maxPrizes; i++) {
        const participant = contest.participants[i];
        const prize = prizes[i + 1]; // 1-indexed prizes

        if (prize) {
          await prisma.contestParticipant.update({
            where: {
              contestId_userId: {
                contestId,
                userId: participant.userId
              }
            },
            data: {
              prizeWon: prize.name || prize
            }
          });

          // Create notification
          await prisma.mlmNotification.create({
            data: {
              userId: participant.userId,
              type: 'contest_winner',
              title: `Contest Winner: ${contest.name}`,
              message: `Congratulations! You won ${prize.name || prize} in the ${contest.name} contest.`,
              data: {
                contestId,
                contestName: contest.name,
                prize: prize,
                rank: i + 1
              }
            }
          });
        }
      }

      logger.info('Processed contest results', {
        contestId,
        contestName: contest.name,
        participantsCount: contest.participants.length,
        prizesDistributed: maxPrizes
      });

    } catch (error) {
      logger.error('Error processing contest results:', error);
      throw error;
    }
  }

  /**
   * Update participant scores
   */
  static async updateParticipantScore(contestId: string, userId: string, scoreIncrement: number): Promise<void> {
    try {
      await prisma.contestParticipant.upsert({
        where: {
          contestId_userId: {
            contestId,
            userId
          }
        },
        update: {
          currentScore: {
            increment: scoreIncrement
          }
        },
        create: {
          contestId,
          userId,
          currentScore: scoreIncrement
        }
      });
    } catch (error) {
      logger.error('Error updating participant score:', error);
      throw error;
    }
  }

  /**
   * Get active contests for user
   */
  static async getActiveContestsForUser(userId: string): Promise<any[]> {
    try {
      const contests = await prisma.contest.findMany({
        where: {
          status: 'active',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
          participants: {
            some: { userId }
          }
        },
        include: {
          participants: {
            where: { userId },
            select: { currentScore: true, rank: true }
          }
        }
      });

      return contests.map(contest => ({
        ...contest,
        userParticipation: contest.participants[0] || null
      }));
    } catch (error) {
      logger.error('Error getting active contests:', error);
      return [];
    }
  }
}