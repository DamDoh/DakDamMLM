import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface FinancialDashboardData {
  shareholderId: string;
  totalAccumulatedBenefits: number;
  currentPeriodBenefits: number;
  incomeBreakdown: {
    dividends: number;
    networkBonuses: number;
    governanceBonuses: number;
    referralBonuses: number;
    directBenefits: number;
  };
  realTimeStreams: {
    pendingPayments: number;
    processingPayments: number;
    recentTransactions: Array<{
      id: string;
      type: string;
      amount: number;
      description: string;
      createdAt: string;
      status: string;
    }>;
  };
  historicalData: {
    monthlyTotals: Array<{
      month: string;
      totalBenefits: number;
      breakdown: Record<string, number>;
    }>;
    yearlySummary: {
      currentYear: number;
      totalBenefits: number;
      growthPercentage: number;
    };
  };
  networkStats?: {
    networkSize: number;
    activeReferrals: number;
    networkLevel: number;
    performanceRank: string;
  };
}

export interface TransactionLogEntry {
  id: string;
  transactionId: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  distributionRule: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  paidAt?: string;
  networkLevel?: number;
  referenceId?: string;
}

export class FinancialDashboardService {
  /**
   * Get complete financial dashboard data for a shareholder
   */
  static async getFinancialDashboard(
    userId: string,
    companyId?: string,
    timeRange: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<FinancialDashboardData | null> {
    try {
      // Get shareholder information
      const shareholder = await prisma.shareholder.findFirst({
        where: {
          userId,
          companyId,
          status: 'active'
        },
        include: {
          benefitLedgers: {
            orderBy: { createdAt: 'desc' },
            take: 10 // Recent transactions
          },
          networkReferrals: {
            where: { status: 'active' },
            select: { id: true }
          }
        }
      });

      if (!shareholder) {
        logger.warn('Shareholder not found for financial dashboard', { userId, companyId });
        return null;
      }

      // Calculate date ranges
      const now = new Date();
      const periodStart = this.getPeriodStart(now, timeRange);

      // Get all benefit transactions
      const allBenefits = await prisma.benefitLedger.findMany({
        where: {
          shareholderId: shareholder.id,
          status: { in: ['processed', 'paid'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate totals
      const totalAccumulatedBenefits = allBenefits.reduce((sum, b) => sum + b.amount, 0);

      const currentPeriodBenefits = allBenefits
        .filter(b => b.createdAt >= periodStart)
        .reduce((sum, b) => sum + b.amount, 0);

      // Income breakdown
      const incomeBreakdown = this.calculateIncomeBreakdown(allBenefits);

      // Real-time streams
      const realTimeStreams = await this.getRealTimeStreams(shareholder.id);

      // Historical data
      const historicalData = await this.getHistoricalData(shareholder.id);

      // Network stats (only for Network-Enabled members)
      const networkStats = shareholder.membershipType === 'network_enabled'
        ? await this.getNetworkStats(shareholder.id)
        : undefined;

      return {
        shareholderId: shareholder.id,
        totalAccumulatedBenefits,
        currentPeriodBenefits,
        incomeBreakdown,
        realTimeStreams,
        historicalData,
        networkStats
      };

    } catch (error) {
      logger.error('Failed to get financial dashboard', {
        userId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get detailed transaction history with pagination
   */
  static async getTransactionHistory(
    userId: string,
    companyId?: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    transactions: TransactionLogEntry[];
    totalCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    try {
      const shareholder = await prisma.shareholder.findFirst({
        where: {
          userId,
          companyId,
          status: 'active'
        }
      });

      if (!shareholder) {
        throw new Error('Shareholder not found');
      }

      const {
        page = 1,
        limit = 20,
        type,
        status,
        startDate,
        endDate
      } = options;

      const skip = (page - 1) * limit;

      const where: any = {
        shareholderId: shareholder.id
      };

      if (type) where.transactionType = type;
      if (status) where.status = status;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [transactions, totalCount] = await Promise.all([
        prisma.benefitLedger.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.benefitLedger.count({ where })
      ]);

      const transactionEntries: TransactionLogEntry[] = transactions.map(t => ({
        id: t.id,
        transactionId: `TXN_${t.id.slice(-8)}`,
        type: t.transactionType,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        distributionRule: t.distributionRule,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        processedAt: t.processedAt?.toISOString(),
        paidAt: t.paidAt?.toISOString(),
        networkLevel: t.networkLevel || undefined,
        referenceId: t.referenceId || undefined
      }));

      return {
        transactions: transactionEntries,
        totalCount,
        page,
        limit,
        hasMore: skip + limit < totalCount
      };

    } catch (error) {
      logger.error('Failed to get transaction history', {
        userId,
        companyId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get real-time payment streams
   */
  private static async getRealTimeStreams(shareholderId: string): Promise<FinancialDashboardData['realTimeStreams']> {
    const [pendingPayments, processingPayments, recentTransactions] = await Promise.all([
      prisma.benefitLedger.count({
        where: { shareholderId, status: 'pending' }
      }),
      prisma.benefitLedger.count({
        where: { shareholderId, status: 'processed' }
      }),
      prisma.benefitLedger.findMany({
        where: { shareholderId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          transactionType: true,
          amount: true,
          description: true,
          createdAt: true,
          status: true
        }
      })
    ]);

    return {
      pendingPayments: await this.getTotalAmount(shareholderId, 'pending'),
      processingPayments: await this.getTotalAmount(shareholderId, 'processed'),
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        status: t.status
      }))
    };
  }

  /**
   * Calculate income breakdown by type
   */
  private static calculateIncomeBreakdown(benefits: any[]): FinancialDashboardData['incomeBreakdown'] {
    return benefits.reduce(
      (breakdown, benefit) => {
        switch (benefit.transactionType) {
          case 'dividend':
            breakdown.dividends += benefit.amount;
            break;
          case 'network_bonus':
            breakdown.networkBonuses += benefit.amount;
            break;
          case 'governance_bonus':
            breakdown.governanceBonuses += benefit.amount;
            break;
          case 'referral_bonus':
            breakdown.referralBonuses += benefit.amount;
            break;
          case 'direct_benefit':
            breakdown.directBenefits += benefit.amount;
            break;
        }
        return breakdown;
      },
      {
        dividends: 0,
        networkBonuses: 0,
        governanceBonuses: 0,
        referralBonuses: 0,
        directBenefits: 0
      }
    );
  }

  /**
   * Get historical monthly data
   */
  private static async getHistoricalData(shareholderId: string): Promise<FinancialDashboardData['historicalData']> {
    // Get last 12 months of data
    const monthlyTotals: Array<{ month: string; totalBenefits: number; breakdown: Record<string, number> }> = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthBenefits = await prisma.benefitLedger.findMany({
        where: {
          shareholderId,
          createdAt: { gte: monthStart, lte: monthEnd },
          status: { in: ['processed', 'paid'] }
        }
      });

      const breakdown = monthBenefits.reduce((acc, benefit) => {
        acc[benefit.transactionType] = (acc[benefit.transactionType] || 0) + benefit.amount;
        return acc;
      }, {} as Record<string, number>);

      monthlyTotals.push({
        month: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        totalBenefits: monthBenefits.reduce((sum, b) => sum + b.amount, 0),
        breakdown
      });
    }

    // Calculate yearly summary
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearBenefits = await prisma.benefitLedger.findMany({
      where: {
        shareholderId,
        createdAt: { gte: yearStart },
        status: { in: ['processed', 'paid'] }
      }
    });

    const totalBenefits = yearBenefits.reduce((sum, b) => sum + b.amount, 0);

    // Calculate growth (compare with previous year)
    const prevYearStart = new Date(currentYear - 1, 0, 1);
    const prevYearEnd = new Date(currentYear - 1, 11, 31);
    const prevYearBenefits = await prisma.benefitLedger.findMany({
      where: {
        shareholderId,
        createdAt: { gte: prevYearStart, lte: prevYearEnd },
        status: { in: ['processed', 'paid'] }
      }
    });

    const prevYearTotal = prevYearBenefits.reduce((sum, b) => sum + b.amount, 0);
    const growthPercentage = prevYearTotal > 0 ? ((totalBenefits - prevYearTotal) / prevYearTotal) * 100 : 0;

    return {
      monthlyTotals,
      yearlySummary: {
        currentYear,
        totalBenefits,
        growthPercentage
      }
    };
  }

  /**
   * Get network statistics for Network-Enabled members
   */
  private static async getNetworkStats(shareholderId: string): Promise<FinancialDashboardData['networkStats']> {
    const shareholder = await prisma.shareholder.findUnique({
      where: { id: shareholderId },
      include: {
        networkReferrals: {
          where: { status: 'active' },
          select: { id: true }
        },
        _count: {
          select: {
            networkReferrals: true
          }
        }
      }
    });

    if (!shareholder) return undefined;

    const networkSize = shareholder._count.networkReferrals;
    const activeReferrals = shareholder.networkReferrals.length;

    // Calculate network level (simplified)
    let networkLevel = 1;
    if (networkSize >= 100) networkLevel = 4;
    else if (networkSize >= 50) networkLevel = 3;
    else if (networkSize >= 10) networkLevel = 2;

    // Performance rank
    let performanceRank = 'Bronze';
    if (networkSize >= 100) performanceRank = 'Diamond';
    else if (networkSize >= 50) performanceRank = 'Gold';
    else if (networkSize >= 25) performanceRank = 'Silver';
    else if (networkSize >= 10) performanceRank = 'Bronze';

    return {
      networkSize,
      activeReferrals,
      networkLevel,
      performanceRank
    };
  }

  /**
   * Helper to get total amount for status
   */
  private static async getTotalAmount(shareholderId: string, status: string): Promise<number> {
    const result = await prisma.benefitLedger.aggregate({
      where: { shareholderId, status },
      _sum: { amount: true }
    });

    return result._sum.amount || 0;
  }

  /**
   * Get period start date
   */
  private static getPeriodStart(now: Date, range: 'month' | 'quarter' | 'year'): Date {
    const start = new Date(now);

    switch (range) {
      case 'month':
        start.setDate(1);
        break;
      case 'quarter':
        start.setMonth(Math.floor(start.getMonth() / 3) * 3);
        start.setDate(1);
        break;
      case 'year':
        start.setMonth(0);
        start.setDate(1);
        break;
    }

    return start;
  }
}