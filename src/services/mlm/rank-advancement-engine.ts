import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface RankRequirement {
  type: 'pv' | 'gv' | 'downline' | 'volume' | 'leg_volume' | 'active_downline';
  value: number;
  period?: 'month' | 'quarter' | 'year' | 'all_time';
}

export interface RankAdvancementResult {
  userId: string;
  currentRank: string;
  newRank: string;
  qualified: boolean;
  requirements: {
    met: RankRequirement[];
    unmet: RankRequirement[];
  };
  advancementDate?: Date;
}

export class RankAdvancementEngine {
  /**
   * Check if user qualifies for rank advancement
   */
  static async checkRankAdvancement(userId: string): Promise<RankAdvancementResult> {
    try {
      // Get current rank
      const currentAdvancement = await prisma.rankAdvancement.findFirst({
        where: { userId },
        orderBy: { advancementDate: 'desc' },
        include: { toRank: true }
      });

      const currentRank = currentAdvancement?.toRank || await this.getDefaultRank();
      const currentRankLevel = currentRank.level;

      // Get next rank
      const nextRank = await prisma.rank.findFirst({
        where: {
          level: { gt: currentRankLevel },
          isActive: true
        },
        orderBy: { level: 'asc' }
      });

      if (!nextRank) {
        // User is at highest rank
        return {
          userId,
          currentRank: currentRank.name,
          newRank: currentRank.name,
          qualified: false,
          requirements: { met: [], unmet: [] }
        };
      }

      // Check requirements
      const requirements = nextRank.requirements as RankRequirement[];
      const { met, unmet } = await this.evaluateRequirements(userId, requirements);

      const qualified = unmet.length === 0;

      return {
        userId,
        currentRank: currentRank.name,
        newRank: nextRank.name,
        qualified,
        requirements: { met, unmet }
      };

    } catch (error) {
      logger.error('Error checking rank advancement:', error);
      throw error;
    }
  }

  /**
   * Process rank advancement for qualified users
   */
  static async processRankAdvancement(userId: string, result: RankAdvancementResult): Promise<void> {
    if (!result.qualified) {
      throw new Error('User does not qualify for rank advancement');
    }

    try {
      const currentRank = await this.getCurrentRank(userId);
      const newRank = await prisma.rank.findUnique({
        where: { name: result.newRank }
      });

      if (!newRank) {
        throw new Error('New rank not found');
      }

      // Create advancement record
      const advancement = await prisma.rankAdvancement.create({
        data: {
          userId,
          fromRankId: currentRank.id,
          toRankId: newRank.id,
          advancementDate: new Date(),
          reason: 'automatic_advancement',
          pvAtAdvancement: await this.getCurrentPV(userId),
          gvAtAdvancement: await this.getCurrentGV(userId)
        }
      });

      // Update user's rank
      await prisma.user.update({
        where: { id: userId },
        data: { rank: newRank.name }
      });

      // Create notification
      await this.createAdvancementNotification(userId, currentRank.name, newRank.name);

      // Check for further advancements
      const nextResult = await this.checkRankAdvancement(userId);
      if (nextResult.qualified) {
        // Schedule next advancement if qualified
        setTimeout(() => {
          this.processRankAdvancement(userId, nextResult);
        }, 1000);
      }

      logger.info('Processed rank advancement', {
        userId,
        fromRank: currentRank.name,
        toRank: newRank.name,
        advancementId: advancement.id
      });

    } catch (error) {
      logger.error('Error processing rank advancement:', error);
      throw error;
    }
  }

  /**
   * Evaluate rank requirements
   */
  private static async evaluateRequirements(
    userId: string,
    requirements: RankRequirement[]
  ): Promise<{ met: RankRequirement[]; unmet: RankRequirement[] }> {
    const met: RankRequirement[] = [];
    const unmet: RankRequirement[] = [];

    for (const req of requirements) {
      const satisfied = await this.checkRequirement(userId, req);
      if (satisfied) {
        met.push(req);
      } else {
        unmet.push(req);
      }
    }

    return { met, unmet };
  }

  /**
   * Check individual requirement
   */
  private static async checkRequirement(userId: string, requirement: RankRequirement): Promise<boolean> {
    try {
      switch (requirement.type) {
        case 'pv':
          return await this.checkPVRequirement(userId, requirement);

        case 'gv':
          return await this.checkGVRequirement(userId, requirement);

        case 'downline':
          return await this.checkDownlineRequirement(userId, requirement);

        case 'volume':
          return await this.checkVolumeRequirement(userId, requirement);

        case 'leg_volume':
          return await this.checkLegVolumeRequirement(userId, requirement);

        case 'active_downline':
          return await this.checkActiveDownlineRequirement(userId, requirement);

        default:
          return false;
      }
    } catch (error) {
      logger.error('Error checking requirement:', error);
      return false;
    }
  }

  /**
   * Check PV (Personal Volume) requirement
   */
  private static async checkPVRequirement(userId: string, req: RankRequirement): Promise<boolean> {
    const startDate = this.getPeriodStartDate(req.period || 'all_time');

    const pvResult = await prisma.order.aggregate({
      where: {
        userId,
        createdAt: startDate ? { gte: startDate } : undefined,
        items: {
          some: {
            product: {
              pv: { gt: 0 }
            }
          }
        }
      },
      _sum: {
        items: {
          pv: true
        }
      }
    });

    const totalPV = pvResult._sum.items?.pv || 0;
    return totalPV >= req.value;
  }

  /**
   * Check GV (Group Volume) requirement
   */
  private static async checkGVRequirement(userId: string, req: RankRequirement): Promise<boolean> {
    const genealogy = await prisma.genealogyTree.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            sponsored: {
              where: {
                createdAt: this.getPeriodStartDate(req.period || 'all_time')
                  ? { gte: this.getPeriodStartDate(req.period || 'all_time')! }
                  : undefined
              },
              include: {
                orders: {
                  include: {
                    items: {
                      include: { product: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!genealogy) return false;

    let totalGV = 0;

    // Calculate GV from downline
    const calculateDownlineGV = (users: any[]): number => {
      let gv = 0;
      for (const user of users) {
        for (const order of user.orders) {
          for (const item of order.items) {
            gv += item.product.pv * item.quantity;
          }
        }
        // Recursively calculate deeper levels if needed
        // This is simplified - real implementation would traverse the tree
      }
      return gv;
    };

    totalGV = calculateDownlineGV(genealogy.user.sponsored);
    return totalGV >= req.value;
  }

  /**
   * Check downline count requirement
   */
  private static async checkDownlineRequirement(userId: string, req: RankRequirement): Promise<boolean> {
    const startDate = this.getPeriodStartDate(req.period || 'all_time');

    const downlineCount = await prisma.user.count({
      where: {
        sponsorId: userId,
        createdAt: startDate ? { gte: startDate } : undefined
      }
    });

    return downlineCount >= req.value;
  }

  /**
   * Check volume requirement
   */
  private static async checkVolumeRequirement(userId: string, req: RankRequirement): Promise<boolean> {
    const genealogy = await prisma.genealogyTree.findUnique({
      where: { userId },
      select: { totalVolume: true }
    });

    return (genealogy?.totalVolume || 0) >= req.value;
  }

  /**
   * Check leg volume requirement (for binary systems)
   */
  private static async checkLegVolumeRequirement(userId: string, req: RankRequirement): Promise<boolean> {
    const genealogy = await prisma.genealogyTree.findUnique({
      where: { userId },
      select: { leftVolume: true, rightVolume: true }
    });

    if (!genealogy) return false;

    const weakerLeg = Math.min(genealogy.leftVolume, genealogy.rightVolume);
    return weakerLeg >= req.value;
  }

  /**
   * Check active downline requirement
   */
  private static async checkActiveDownlineRequirement(userId: string, req: RankRequirement): Promise<boolean> {
    const startDate = this.getPeriodStartDate(req.period || 'all_time');

    const activeDownlineCount = await prisma.user.count({
      where: {
        sponsorId: userId,
        active: true,
        createdAt: startDate ? { gte: startDate } : undefined
      }
    });

    return activeDownlineCount >= req.value;
  }

  /**
   * Get period start date
   */
  private static getPeriodStartDate(period: string): Date | null {
    const now = new Date();

    switch (period) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        return new Date(now.getFullYear(), quarterStart, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      case 'all_time':
      default:
        return null;
    }
  }

  /**
   * Get current rank for user
   */
  private static async getCurrentRank(userId: string) {
    const advancement = await prisma.rankAdvancement.findFirst({
      where: { userId },
      orderBy: { advancementDate: 'desc' },
      include: { toRank: true }
    });

    return advancement?.toRank || await this.getDefaultRank();
  }

  /**
   * Get default rank
   */
  private static async getDefaultRank() {
    return await prisma.rank.findFirst({
      where: { level: 1 },
      orderBy: { level: 'asc' }
    }) || {
      id: 'default',
      name: 'Member',
      level: 1,
      requirements: [],
      benefits: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get current PV for user
   */
  private static async getCurrentPV(userId: string): Promise<number> {
    const result = await prisma.order.aggregate({
      where: { userId },
      _sum: {
        items: {
          pv: true
        }
      }
    });

    return result._sum.items?.pv || 0;
  }

  /**
   * Get current GV for user
   */
  private static async getCurrentGV(userId: string): Promise<number> {
    // Simplified GV calculation
    const genealogy = await prisma.genealogyTree.findUnique({
      where: { userId },
      select: { totalVolume: true }
    });

    return genealogy?.totalVolume || 0;
  }

  /**
   * Create advancement notification
   */
  private static async createAdvancementNotification(
    userId: string,
    fromRank: string,
    toRank: string
  ): Promise<void> {
    await prisma.mlmNotification.create({
      data: {
        userId,
        type: 'rank_advancement',
        title: 'Rank Advancement!',
        message: `Congratulations! You've advanced from ${fromRank} to ${toRank} rank.`,
        data: {
          fromRank,
          toRank,
          advancementDate: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Bulk check rank advancements for all users
   */
  static async processBulkRankAdvancements(): Promise<number> {
    try {
      const users = await prisma.user.findMany({
        where: { active: true },
        select: { id: true }
      });

      let advancementCount = 0;

      for (const user of users) {
        try {
          const result = await this.checkRankAdvancement(user.id);
          if (result.qualified) {
            await this.processRankAdvancement(user.id, result);
            advancementCount++;
          }
        } catch (error) {
          logger.error(`Error processing rank advancement for user ${user.id}:`, error);
        }
      }

      logger.info('Completed bulk rank advancement processing', { advancementCount });
      return advancementCount;

    } catch (error) {
      logger.error('Error in bulk rank advancement processing:', error);
      throw error;
    }
  }
}