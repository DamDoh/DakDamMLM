import { commissionDb } from '../config/database';
import { logger, logBonusAchieved } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Prisma, PrismaClient } from '@prisma/client';

// Type assertion to fix TypeScript language server cache issues
const typedCommissionDb = commissionDb as PrismaClient & {
  commissionBonus: {
    create: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any | null>;
    count: (args?: any) => Promise<number>;
    aggregate: (args: any) => Promise<any>;
    groupBy: (args: any) => Promise<any[]>;
  };
};

interface BonusQuery {
  page: number;
  limit: number;
  type?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
}

interface BonusAnalyticsQuery {
  period: string;
  startDate?: string;
  endDate?: string;
}

export class BonusService {
  async calculateBonuses(period: string) {
    const bonuses = [];

    // Calculate different types of bonuses based on period
    const fastStartBonuses = await this.calculateFastStartBonuses(period);
    const monthlyBonuses = await this.calculateMonthlyBonuses(period);
    const quarterlyBonuses = await this.calculateQuarterlyBonuses(period);
    const annualBonuses = await this.calculateAnnualBonuses(period);
    const rankBonuses = await this.calculateRankAdvancementBonuses(period);

    bonuses.push(...fastStartBonuses, ...monthlyBonuses, ...quarterlyBonuses, ...annualBonuses, ...rankBonuses);

    // Save bonuses to database
    for (const bonus of bonuses) {
      await typedCommissionDb.commissionBonus.create({
        data: bonus as any,
      });

      logBonusAchieved(bonus.userId, bonus.type, bonus.amount, period);
    }

    logger.info('Bonuses calculated and saved', {
      period,
      totalBonuses: bonuses.length,
      totalAmount: bonuses.reduce((sum, b) => sum + b.amount, 0),
    });

    return bonuses;
  }

  async getBonuses(query: BonusQuery) {
    const { page, limit, type, period, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (period) where.period = period;
    if (startDate || endDate) {
      where.achievedAt = {};
      if (startDate) where.achievedAt.gte = new Date(startDate);
      if (endDate) where.achievedAt.lte = new Date(endDate);
    }

    const [bonuses, total] = await Promise.all([
      typedCommissionDb.commissionBonus.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              memberId: true,
              rank: true,
            },
          },
        },
        orderBy: { achievedAt: 'desc' },
        skip,
        take: limit,
      }),
      typedCommissionDb.commissionBonus.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      bonuses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getBonusById(bonusId: string) {
    return await typedCommissionDb.commissionBonus.findUnique({
      where: { id: bonusId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            memberId: true,
            rank: true,
          },
        },
      },
    });
  }

  async getUserBonuses(userId: string, page: number = 1, limit: number = 10, type?: string, period?: string) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type) where.type = type;
    if (period) where.period = period;

    const [bonuses, total] = await Promise.all([
      typedCommissionDb.commissionBonus.findMany({
        where,
        orderBy: { achievedAt: 'desc' },
        skip,
        take: limit,
      }),
      typedCommissionDb.commissionBonus.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      bonuses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getBonusAnalytics(query: BonusAnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query.period);

    const [stats, typeStats, topPerformers] = await Promise.all([
      // Overall statistics
      typedCommissionDb.commissionBonus.aggregate({
        where: {
          achievedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          amount: true,
        },
      }),
      // By type
      typedCommissionDb.commissionBonus.groupBy({
        by: ['type'],
        where: {
          achievedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          amount: true,
        },
      }),
      // Top performers
      typedCommissionDb.commissionBonus.groupBy({
        by: ['userId'],
        where: {
          achievedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    const totalBonuses = stats._count;
    const totalAmount = stats._sum.amount || 0;

    const bonusesByType = typeStats.map((stat: typeof typeStats[number]) => ({
      type: stat.type,
      count: stat._count,
      amount: stat._sum.amount || 0,
    }));

    const topPerformersData = await Promise.all(
      topPerformers.map(async (performer: typeof topPerformers[number]) => {
        const user = await commissionDb.user.findUnique({
          where: { id: performer.userId },
          select: { fullName: true, memberId: true },
        });

        return {
          userId: performer.userId,
          name: user?.fullName || 'Unknown',
          memberId: user?.memberId || 'Unknown',
          bonusCount: performer._count,
          totalBonus: performer._sum.amount || 0,
        };
      })
    );

    return {
      period: query.period,
      startDate,
      endDate,
      totalBonuses,
      totalAmount,
      bonusesByType,
      topPerformers: topPerformersData,
    };
  }

  private async calculateFastStartBonuses(period: string) {
    const bonuses = [];
    const { startDate, endDate } = this.getDateRange(period);

    // Find users who joined and achieved certain milestones within first 30 days
    const newUsers = await commissionDb.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        active: true,
      },
    });

    for (const user of newUsers) {
      // Fast start bonus for recruiting first downline within 7 days
      const firstDownline = await commissionDb.user.findFirst({
        where: {
          sponsorId: user.id,
          createdAt: {
            gte: user.createdAt,
            lte: new Date(user.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (firstDownline) {
        bonuses.push({
          id: uuidv4(),
          userId: user.id,
          type: 'FAST_START',
          amount: 100, // $100 fast start bonus
          description: 'Fast start bonus for recruiting first downline within 7 days',
          period,
          achievedAt: new Date(),
        });
      }

      // Additional fast start bonus for reaching $500 in commissions within 30 days
      const totalCommissions = await commissionDb.commission.aggregate({
        where: {
          userId: user.id,
          createdAt: {
            gte: user.createdAt,
            lte: new Date(user.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
          status: 'PAID' as const,
        } as Prisma.CommissionWhereInput,
        _sum: {
          amount: true,
        },
      });

      if ((totalCommissions._sum?.amount || 0) >= 500) {
        bonuses.push({
          id: uuidv4(),
          userId: user.id,
          type: 'FAST_START',
          amount: 250, // $250 performance bonus
          description: 'Performance bonus for reaching $500 in commissions within 30 days',
          period,
          achievedAt: new Date(),
        });
      }
    }

    return bonuses;
  }

  private async calculateMonthlyBonuses(period: string) {
    const bonuses = [];
    const { startDate, endDate } = this.getDateRange(period);

    // Calculate monthly performance bonuses based on team volume
    const users = await commissionDb.user.findMany({
      where: { active: true },
    });

    for (const user of users) {
      const totalCommissions = await commissionDb.commission.aggregate({
        where: {
          userId: user.id,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          status: 'PAID' as const,
        } as Prisma.CommissionWhereInput,
        _sum: {
          amount: true,
        },
      });

      const monthlyVolume = totalCommissions._sum?.amount || 0;

      // Monthly bonus tiers
      let bonusAmount = 0;
      if (monthlyVolume >= 5000) {
        bonusAmount = 500; // Top performer bonus
      } else if (monthlyVolume >= 2500) {
        bonusAmount = 250; // High performer bonus
      } else if (monthlyVolume >= 1000) {
        bonusAmount = 100; // Consistent performer bonus
      }

      if (bonusAmount > 0) {
        bonuses.push({
          id: uuidv4(),
          userId: user.id,
          type: 'MONTHLY',
          amount: bonusAmount,
          description: `Monthly performance bonus for $${monthlyVolume} in commissions`,
          period,
          achievedAt: new Date(),
        });
      }
    }

    return bonuses;
  }

  private async calculateQuarterlyBonuses(period: string) {
    const bonuses = [];
    const { startDate, endDate } = this.getDateRange(period);

    // Calculate quarterly leadership bonuses
    const users = await commissionDb.user.findMany({
      where: { active: true },
    });

    for (const user of users) {
      // Check if user maintained consistent performance throughout quarter
      const monthlyVolumes = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const monthlyStats = await commissionDb.commission.aggregate({
          where: {
            userId: user.id,
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
            status: 'PAID' as const,
          } as Prisma.CommissionWhereInput,
          _sum: {
            amount: true,
          },
        });

        monthlyVolumes.push(monthlyStats._sum?.amount || 0);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Quarterly consistency bonus
      const avgMonthlyVolume = monthlyVolumes.reduce((sum, vol) => sum + vol, 0) / monthlyVolumes.length;
      const consistencyScore = monthlyVolumes.filter(vol => vol >= avgMonthlyVolume * 0.8).length / monthlyVolumes.length;

      if (consistencyScore >= 0.75 && avgMonthlyVolume >= 1500) {
        bonuses.push({
          id: uuidv4(),
          userId: user.id,
          type: 'QUARTERLY',
          amount: 750, // $750 quarterly consistency bonus
          description: `Quarterly consistency bonus for maintaining ${Math.round(consistencyScore * 100)}% performance`,
          period,
          achievedAt: new Date(),
        });
      }
    }

    return bonuses;
  }

  private async calculateAnnualBonuses(period: string) {
    const bonuses = [];
    const { startDate, endDate } = this.getDateRange(period);

    // Calculate annual achievement bonuses
    const users = await commissionDb.user.findMany({
      where: { active: true },
    });

    for (const user of users) {
      const annualStats = await commissionDb.commission.aggregate({
        where: {
          userId: user.id,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          status: 'PAID' as const,
        } as Prisma.CommissionWhereInput,
        _sum: {
          amount: true,
        },
      });

      const annualVolume = annualStats._sum?.amount || 0;

      // Annual achievement tiers
      let bonusAmount = 0;
      let description = '';

      if (annualVolume >= 50000) {
        bonusAmount = 5000; // Diamond achiever
        description = 'Diamond achiever annual bonus for $50K+ in commissions';
      } else if (annualVolume >= 25000) {
        bonusAmount = 2500; // Gold achiever
        description = 'Gold achiever annual bonus for $25K+ in commissions';
      } else if (annualVolume >= 10000) {
        bonusAmount = 1000; // Silver achiever
        description = 'Silver achiever annual bonus for $10K+ in commissions';
      }

      if (bonusAmount > 0) {
        bonuses.push({
          id: uuidv4(),
          userId: user.id,
          type: 'ANNUAL',
          amount: bonusAmount,
          description,
          period,
          achievedAt: new Date(),
        });
      }
    }

    return bonuses;
  }

  private async calculateRankAdvancementBonuses(period: string) {
    const bonuses = [];
    const { startDate, endDate } = this.getDateRange(period);

    // Find users who advanced ranks during the period
    const rankAdvancements = await commissionDb.user.findMany({
      where: {
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
        active: true,
      },
    });

    for (const user of rankAdvancements) {
      // Check if rank was updated during this period
      // This is a simplified check - in reality you'd track rank history
      const bonusAmount = this.getRankAdvancementBonus(user.rank);

      if (bonusAmount > 0) {
        bonuses.push({
          id: uuidv4(),
          userId: user.id,
          type: 'RANK_ADVANCEMENT',
          amount: bonusAmount,
          description: `Rank advancement bonus for reaching ${user.rank} level`,
          period,
          achievedAt: new Date(),
        });
      }
    }

    return bonuses;
  }

  private getRankAdvancementBonus(rank: string): number {
    const rankBonuses: Record<string, number> = {
      'Bronze': 50,
      'Silver': 100,
      'Gold': 250,
      'Diamond': 500,
      'Super Diamond': 1000,
      'STAR': 1500,
      'Elite': 2000,
      'Supervisor': 2500,
      'Manager': 3000,
      'Director': 4000,
      'President': 5000,
      'Chairman': 7500,
      'Black Diamond': 10000,
      'Emerald': 15000,
      'Blue Emerald': 20000,
    };

    return rankBonuses[rank] || 0;
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }
}