import { prisma } from '@/lib/database';

export class FinancialMetrics {
  async calculateComplianceScore(): Promise<number> {
    try {
      const totalMembers = await prisma.user.count({
        where: {
          isAdmin: false,
          deleted: false
        }
      });

      if (totalMembers === 0) return 0;

      const totalAgreements = await prisma.memberAgreement.count();
      return Math.round((totalAgreements / totalMembers) * 100);
    } catch (error) {
      console.error('Failed to calculate compliance score:', error);
      return 0;
    }
  }

  async calculateFinancialScore(): Promise<number> {
    try {
      // Calculate financial health based on revenue, expenses, and profitability
      const [totalRevenue, totalExpenses, netProfit, cashFlow] = await Promise.all([
        this.getTotalRevenue(),
        this.getTotalExpenses(),
        this.getNetProfit(),
        this.getCashFlowHealth()
      ]);

      // Financial health scoring algorithm - no base score, purely data-driven
      let score = 0;

      // Revenue factor (25% weight) - having any revenue is positive
      if (totalRevenue > 0) {
        score += 25; // Any revenue generation gets base points
      }

      // Profitability factor (35% weight) - most important metric
      if (netProfit > 0) {
        const profitMargin = (netProfit / Math.max(totalRevenue, 1)) * 100;
        if (profitMargin > 20) score += 35; // Excellent profitability
        else if (profitMargin > 15) score += 30; // Very good profitability
        else if (profitMargin > 10) score += 25; // Good profitability
        else if (profitMargin > 5) score += 15; // Moderate profitability
        else score += 10; // Low but positive profitability
      } else if (netProfit < 0) {
        score += 5; // Some points for having operations, even if losing money
      }

      // Expense management factor (25% weight)
      if (totalRevenue > 0 && totalExpenses > 0) {
        const expenseRatio = (totalExpenses / totalRevenue) * 100;
        if (expenseRatio < 60) score += 25; // Excellent expense management
        else if (expenseRatio < 70) score += 20; // Very good expense management
        else if (expenseRatio < 80) score += 15; // Good expense management
        else if (expenseRatio < 90) score += 10; // Moderate expense management
        else score += 5; // High expenses but still operational
      }

      // Cash flow factor (15% weight) - liquidity indicator
      score += Math.min(cashFlow * 15, 15); // Cash flow health contributes up to 15 points

      return Math.max(0, Math.min(100, score)); // Bound between 0-100
    } catch (error) {
      console.error('Failed to calculate financial score:', error);
      return 0; // Return 0 if calculation fails
    }
  }

  private async getTotalRevenue(): Promise<number> {
    try {
      // Revenue from commissions and orders
      const [commissionRevenue, orderRevenue] = await Promise.all([
        this.getTotalCommissions(),
        this.getTotalVolume()
      ]);

      return commissionRevenue + orderRevenue;
    } catch (error) {
      console.error('Failed to get total revenue:', error);
      return 0;
    }
  }

  private async getTotalExpenses(): Promise<number> {
    try {
      // For now, estimate expenses as a percentage of revenue
      // In a real implementation, this would query expense records
      const revenue = await this.getTotalRevenue();
      const expenseRatio = 0.65; // Assume 65% expense ratio (industry average)
      return revenue * expenseRatio;
    } catch (error) {
      console.error('Failed to get total expenses:', error);
      return 0;
    }
  }

  private async getNetProfit(): Promise<number> {
    try {
      const revenue = await this.getTotalRevenue();
      const expenses = await this.getTotalExpenses();
      return revenue - expenses;
    } catch (error) {
      console.error('Failed to get net profit:', error);
      return 0;
    }
  }

  private async getCashFlowHealth(): Promise<number> {
    try {
      // Simplified cash flow health based on profitability and liquidity
      const netProfit = await this.getNetProfit();
      const totalRevenue = await this.getTotalRevenue();

      if (totalRevenue === 0) return 0;

      // Cash flow health score (0-1 scale)
      const profitMargin = netProfit / totalRevenue;

      if (profitMargin > 0.15) return 1.0; // Excellent cash flow
      else if (profitMargin > 0.08) return 0.8; // Good cash flow
      else if (profitMargin > 0.03) return 0.6; // Moderate cash flow
      else if (profitMargin > 0) return 0.4; // Weak positive cash flow
      else return 0.1; // Negative cash flow
    } catch (error) {
      console.error('Failed to get cash flow health:', error);
      return 0;
    }
  }

  private async getTotalCommissions(): Promise<number> {
    try {
      // First, get all non-admin, non-deleted user IDs
      const eligibleUsers = await prisma.user.findMany({
        where: {
          isAdmin: false,
          deleted: false
        },
        select: {
          id: true
        }
      });

      const userIds = eligibleUsers.map(u => u.id);

      // Then aggregate commissions for those users
      const result = await prisma.commission.aggregate({
        _sum: {
          amount: true
        },
        where: {
          userId: {
            in: userIds
          }
        }
      });

      return result._sum.amount || 0;
    } catch (error) {
      console.error('Failed to get total commissions:', error);
      return 0;
    }
  }

  private async getTotalVolume(): Promise<number> {
    try {
      // First, get all non-admin, non-deleted user IDs
      const eligibleUsers = await prisma.user.findMany({
        where: {
          isAdmin: false,
          deleted: false
        },
        select: {
          id: true
        }
      });

      const userIds = eligibleUsers.map(u => u.id);

      // Then aggregate orders for those users
      const result = await prisma.order.aggregate({
        _sum: {
          totalAmount: true
        },
        where: {
          userId: {
            in: userIds
          }
        }
      });

      return result._sum.totalAmount || 0;
    } catch (error) {
      console.error('Failed to get total volume:', error);
      return 0;
    }
  }
}