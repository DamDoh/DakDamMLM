import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface DistributionContext {
  companyId: string;
  totalProfits: number;
  periodStart: Date;
  periodEnd: Date;
  distributionRules?: {
    shareholderDividendPercentage: number; // e.g., 0.6 for 60%
    networkBonusPercentage: number;       // e.g., 0.2 for 20%
    governanceBonusPercentage: number;    // e.g., 0.1 for 10%
    reservePercentage: number;            // e.g., 0.1 for 10%
  };
}

export interface NetworkBonusCalculation {
  shareholderId: string;
  networkSize: number;
  referralCount: number;
  networkGrowth: number; // Percentage growth in network
  bonusMultiplier: number;
  calculatedBonus: number;
}

export interface DistributionResult {
  totalDistributed: number;
  shareholderDividends: number;
  networkBonuses: number;
  governanceBonuses: number;
  reserves: number;
  transactionsCreated: number;
  auditEntries: number;
}

export class ProfitDistributionEngine {
  private static readonly DEFAULT_RULES = {
    shareholderDividendPercentage: 0.6,  // 60% to shareholders
    networkBonusPercentage: 0.2,         // 20% to network bonuses
    governanceBonusPercentage: 0.1,      // 10% to board/governance
    reservePercentage: 0.1               // 10% to reserves
  };

  /**
   * Main profit distribution orchestrator
   */
  static async distributeCompanyProfits(context: DistributionContext): Promise<DistributionResult> {
    const rules = { ...this.DEFAULT_RULES, ...context.distributionRules };

    logger.info('Starting profit distribution', {
      companyId: context.companyId,
      totalProfits: context.totalProfits,
      rules
    });

    const result: DistributionResult = {
      totalDistributed: 0,
      shareholderDividends: 0,
      networkBonuses: 0,
      governanceBonuses: 0,
      reserves: 0,
      transactionsCreated: 0,
      auditEntries: 0
    };

    try {
      // 1. Calculate shareholder dividends (pro-rata)
      const dividendAmount = context.totalProfits * rules.shareholderDividendPercentage;
      result.shareholderDividends = await this.distributeShareholderDividends(
        context.companyId,
        dividendAmount,
        context.periodStart,
        context.periodEnd
      );

      // 2. Calculate and distribute network bonuses
      const networkBonusAmount = context.totalProfits * rules.networkBonusPercentage;
      const networkResult = await this.distributeNetworkBonuses(
        context.companyId,
        networkBonusAmount,
        context.periodStart,
        context.periodEnd
      );
      result.networkBonuses = networkResult.totalBonuses;

      // 3. Calculate governance bonuses (board-controlled)
      const governanceAmount = context.totalProfits * rules.governanceBonusPercentage;
      result.governanceBonuses = await this.distributeGovernanceBonuses(
        context.companyId,
        governanceAmount,
        context.periodStart,
        context.periodEnd
      );

      // 4. Allocate reserves
      result.reserves = context.totalProfits * rules.reservePercentage;

      // 5. Create reserve allocation record
      if (result.reserves > 0) {
        await this.createReserveAllocation(
          context.companyId,
          result.reserves,
          context.periodStart,
          context.periodEnd
        );
      }

      result.totalDistributed = result.shareholderDividends + result.networkBonuses + result.governanceBonuses + result.reserves;

      // 6. Final audit log
      await this.createDistributionAuditLog(context, result);

      logger.info('Profit distribution completed', {
        companyId: context.companyId,
        result
      });

      return result;

    } catch (error) {
      logger.error('Profit distribution failed', {
        companyId: context.companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Distribute dividends to shareholders based on ownership percentage
   */
  private static async distributeShareholderDividends(
    companyId: string,
    totalDividendAmount: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    // Get all active shareholders for the company
    const shareholders = await prisma.shareholder.findMany({
      where: {
        companyId,
        status: 'active',
        dividendEligible: true,
        sharePercentage: { gt: 0 }
      },
      select: {
        id: true,
        userId: true,
        sharePercentage: true,
        totalShares: true
      }
    });

    if (shareholders.length === 0) {
      logger.warn('No eligible shareholders found for dividend distribution', { companyId });
      return 0;
    }

    let totalDistributed = 0;

    for (const shareholder of shareholders) {
      // Calculate pro-rata dividend based on share percentage
      const dividendAmount = totalDividendAmount * (shareholder.sharePercentage / 100);

      if (dividendAmount > 0) {
        await this.createBenefitTransaction({
          shareholderId: shareholder.id,
          companyId,
          transactionType: 'dividend',
          amount: dividendAmount,
          description: `Pro-rata dividend distribution for ${shareholder.sharePercentage}% ownership`,
          distributionRule: 'pro_rata_dividend',
          periodStart,
          periodEnd
        });

        totalDistributed += dividendAmount;
      }
    }

    logger.info('Shareholder dividends distributed', {
      companyId,
      shareholderCount: shareholders.length,
      totalDividendAmount,
      totalDistributed
    });

    return totalDistributed;
  }

  /**
   * Calculate and distribute network bonuses for Network-Enabled members
   */
  private static async distributeNetworkBonuses(
    companyId: string,
    totalBonusAmount: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ totalBonuses: number; bonusDetails: NetworkBonusCalculation[] }> {
    // Get all Network-Enabled shareholders
    const networkEnabledShareholders = await prisma.shareholder.findMany({
      where: {
        companyId,
        membershipType: 'network_enabled',
        canBuildNetwork: true,
        status: 'active'
      },
      select: {
        id: true,
        userId: true,
        networkReferrals: {
          where: {
            status: 'active',
            acquisitionDate: {
              gte: periodStart,
              lte: periodEnd
            }
          },
          select: { id: true }
        }
      }
    });

    const bonusDetails: NetworkBonusCalculation[] = [];
    let totalBonuses = 0;

    for (const shareholder of networkEnabledShareholders) {
      const calculation = await this.calculateNetworkBonus(shareholder, periodStart, periodEnd);

      if (calculation.calculatedBonus > 0) {
        // Allocate bonus proportionally from total bonus pool
        const actualBonus = (calculation.calculatedBonus / this.getTotalNetworkBonusWeight(bonusDetails)) * totalBonusAmount;

        await this.createBenefitTransaction({
          shareholderId: shareholder.id,
          companyId,
          transactionType: 'network_bonus',
          amount: actualBonus,
          description: `Network bonus for ${calculation.networkSize} referrals and ${calculation.networkGrowth}% growth`,
          distributionRule: 'network_growth_bonus',
          networkLevel: 1, // Direct network
          periodStart,
          periodEnd
        });

        calculation.calculatedBonus = actualBonus;
        bonusDetails.push(calculation);
        totalBonuses += actualBonus;
      }
    }

    logger.info('Network bonuses distributed', {
      companyId,
      networkEnabledCount: networkEnabledShareholders.length,
      totalBonusAmount,
      totalBonuses,
      bonusDetails
    });

    return { totalBonuses, bonusDetails };
  }

  /**
   * Calculate network bonus for a shareholder
   */
  private static async calculateNetworkBonus(
    shareholder: any,
    periodStart: Date,
    periodEnd: Date
  ): Promise<NetworkBonusCalculation> {
    const networkSize = shareholder.networkReferrals.length;

    // Calculate network growth (simplified - in reality would track historical network sizes)
    const networkGrowth = networkSize * 10; // Placeholder calculation

    // Bonus multiplier based on network performance
    let bonusMultiplier = 1.0;
    if (networkSize >= 50) bonusMultiplier = 3.0;
    else if (networkSize >= 25) bonusMultiplier = 2.5;
    else if (networkSize >= 10) bonusMultiplier = 2.0;
    else if (networkSize >= 5) bonusMultiplier = 1.5;

    const calculatedBonus = networkSize * networkGrowth * bonusMultiplier;

    return {
      shareholderId: shareholder.id,
      networkSize,
      referralCount: networkSize,
      networkGrowth,
      bonusMultiplier,
      calculatedBonus
    };
  }

  /**
   * Get total weight for proportional bonus allocation
   */
  private static getTotalNetworkBonusWeight(bonusDetails: NetworkBonusCalculation[]): number {
    return bonusDetails.reduce((sum, detail) => sum + detail.calculatedBonus, 0) || 1;
  }

  /**
   * Distribute governance bonuses controlled by Board of Directors
   */
  private static async distributeGovernanceBonuses(
    companyId: string,
    totalGovernanceAmount: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    // Get active board members
    const boardMembers = await prisma.boardMember.findMany({
      where: {
        companyId,
        status: 'active',
        shareholder: {
          status: 'active'
        }
      },
      include: {
        shareholder: true
      }
    });

    if (boardMembers.length === 0) {
      logger.warn('No active board members found for governance bonus distribution', { companyId });
      return 0;
    }

    // Distribute equally among board members (could be customized based on position/role)
    const bonusPerMember = totalGovernanceAmount / boardMembers.length;
    let totalDistributed = 0;

    for (const boardMember of boardMembers) {
      await this.createBenefitTransaction({
        shareholderId: boardMember.shareholderId,
        companyId,
        transactionType: 'governance_bonus',
        amount: bonusPerMember,
        description: `Board governance bonus for ${boardMember.position} position`,
        distributionRule: 'board_governance_bonus',
        periodStart,
        periodEnd
      });

      totalDistributed += bonusPerMember;
    }

    logger.info('Governance bonuses distributed', {
      companyId,
      boardMemberCount: boardMembers.length,
      totalGovernanceAmount,
      bonusPerMember,
      totalDistributed
    });

    return totalDistributed;
  }

  /**
   * Create reserve allocation record
   */
  private static async createReserveAllocation(
    companyId: string,
    amount: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    // Create a special benefit transaction for reserves
    await prisma.benefitLedger.create({
      data: {
        shareholderId: 'system', // System-controlled reserves
        companyId,
        transactionType: 'reserve_allocation',
        amount,
        description: 'Company profit reserves allocation',
        distributionRule: 'profit_reserve_allocation',
        status: 'processed',
        processedAt: new Date(),
        isTaxable: false
      }
    });
  }

  /**
   * Create benefit transaction with audit trail
   */
  private static async createBenefitTransaction(data: {
    shareholderId: string;
    companyId: string;
    transactionType: string;
    amount: number;
    description: string;
    distributionRule: string;
    networkLevel?: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const benefit = await prisma.benefitLedger.create({
      data: {
        shareholderId: data.shareholderId,
        companyId: data.companyId,
        transactionType: data.transactionType,
        amount: data.amount,
        description: data.description,
        distributionRule: data.distributionRule,
        networkLevel: data.networkLevel,
        status: 'processed',
        processedAt: new Date()
      }
    });

    // Create audit log
    await prisma.benefitAuditLog.create({
      data: {
        benefitId: benefit.id,
        action: 'created',
        newValues: {
          transactionType: data.transactionType,
          amount: data.amount,
          distributionRule: data.distributionRule,
          periodStart: data.periodStart.toISOString(),
          periodEnd: data.periodEnd.toISOString()
        },
        performedBy: 'system_distribution_engine'
      }
    });
  }

  /**
   * Create distribution audit log
   */
  private static async createDistributionAuditLog(
    context: DistributionContext,
    result: DistributionResult
  ): Promise<void> {
    await prisma.shareholderAuditLog.create({
      data: {
        shareholderId: 'system', // System-wide distribution log
        action: 'profit_distribution',
        newValues: {
          companyId: context.companyId,
          totalProfits: context.totalProfits,
          periodStart: context.periodStart.toISOString(),
          periodEnd: context.periodEnd.toISOString(),
          distributionResult: result
        },
        reason: 'Automated profit distribution',
        performedBy: 'system_distribution_engine'
      }
    });
  }
}