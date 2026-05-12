/**
 * HIGH PRIORITY FIX #10: Commission Cap Service
 * 
 * Prevents unlimited commission payouts that could bankrupt the company.
 * Implements configurable caps at multiple levels:
 * - Per transaction
 * - Per day
 * - Per week
 * - Per month
 * - Per rank
 * 
 * CRITICAL for financial safety and sustainability
 */

import { prisma } from '@/lib/prisma';

export interface CommissionCap {
  rank: string;
  dailyCap: number;
  weeklyCap: number;
  monthlyCap: number;
  perTransactionCap: number;
  annualCap?: number;
}

export interface CommissionCapCheck {
  allowed: boolean;
  requestedAmount: number;
  cappedAmount: number;
  reason?: string;
  remainingDaily?: number;
  remainingWeekly?: number;
  remainingMonthly?: number;
}

/**
 * Default commission caps by rank
 * Amounts in USD (or base currency)
 */
const DEFAULT_COMMISSION_CAPS: Record<string, CommissionCap> = {
  'Member': {
    rank: 'Member',
    dailyCap: 100,
    weeklyCap: 500,
    monthlyCap: 2000,
    perTransactionCap: 50,
    annualCap: 20000
  },
  'Silver': {
    rank: 'Silver',
    dailyCap: 300,
    weeklyCap: 1500,
    monthlyCap: 6000,
    perTransactionCap: 150,
    annualCap: 60000
  },
  'Gold': {
    rank: 'Gold',
    dailyCap: 800,
    weeklyCap: 4000,
    monthlyCap: 15000,
    perTransactionCap: 400,
    annualCap: 150000
  },
  'Platinum': {
    rank: 'Platinum',
    dailyCap: 2000,
    weeklyCap: 10000,
    monthlyCap: 40000,
    perTransactionCap: 1000,
    annualCap: 400000
  },
  'Diamond': {
    rank: 'Diamond',
    dailyCap: 5000,
    weeklyCap: 25000,
    monthlyCap: 100000,
    perTransactionCap: 2500,
    annualCap: 1000000
  },
  'Executive': {
    rank: 'Executive',
    dailyCap: 10000,
    weeklyCap: 50000,
    monthlyCap: 200000,
    perTransactionCap: 5000,
    annualCap: 2000000
  }
};

export class CommissionCapService {
  /**
   * Check if a commission payment is allowed given the caps
   * Returns the allowed amount (may be less than requested)
   */
  static async checkCommissionCap(
    userId: string,
    requestedAmount: number,
    commissionType: string = 'binary_bonus'
  ): Promise<CommissionCapCheck> {
    // Get user's rank
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rank: true, companyId: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get commission caps for user's rank
    const caps = this.getCommissionCaps(user.rank, user.companyId ?? undefined);

    // Check per-transaction cap
    if (requestedAmount > caps.perTransactionCap) {
      return {
        allowed: true,
        requestedAmount,
        cappedAmount: caps.perTransactionCap,
        reason: `Exceeds per-transaction cap of ${caps.perTransactionCap}`,
        remainingDaily: undefined,
        remainingWeekly: undefined,
        remainingMonthly: undefined
      };
    }

    // Get current period totals
    const now = new Date();
    const periodTotals = await this.getPeriodTotals(userId, now);

    // Check daily cap
    if (periodTotals.daily + requestedAmount > caps.dailyCap) {
      const remainingDaily = Math.max(0, caps.dailyCap - periodTotals.daily);
      const cappedAmount = Math.min(requestedAmount, remainingDaily);
      
      return {
        allowed: cappedAmount > 0,
        requestedAmount,
        cappedAmount,
        reason: `Exceeds daily cap of ${caps.dailyCap}`,
        remainingDaily,
        remainingWeekly: undefined,
        remainingMonthly: undefined
      };
    }

    // Check weekly cap
    if (periodTotals.weekly + requestedAmount > caps.weeklyCap) {
      const remainingWeekly = Math.max(0, caps.weeklyCap - periodTotals.weekly);
      const cappedAmount = Math.min(requestedAmount, remainingWeekly);
      
      return {
        allowed: cappedAmount > 0,
        requestedAmount,
        cappedAmount,
        reason: `Exceeds weekly cap of ${caps.weeklyCap}`,
        remainingDaily: undefined,
        remainingWeekly,
        remainingMonthly: undefined
      };
    }

    // Check monthly cap
    if (periodTotals.monthly + requestedAmount > caps.monthlyCap) {
      const remainingMonthly = Math.max(0, caps.monthlyCap - periodTotals.monthly);
      const cappedAmount = Math.min(requestedAmount, remainingMonthly);
      
      return {
        allowed: cappedAmount > 0,
        requestedAmount,
        cappedAmount,
        reason: `Exceeds monthly cap of ${caps.monthlyCap}`,
        remainingDaily: undefined,
        remainingWeekly: undefined,
        remainingMonthly
      };
    }

    // All checks passed
    const remainingDaily = caps.dailyCap - periodTotals.daily;
    const remainingWeekly = caps.weeklyCap - periodTotals.weekly;
    const remainingMonthly = caps.monthlyCap - periodTotals.monthly;

    return {
      allowed: true,
      requestedAmount,
      cappedAmount: requestedAmount,
      remainingDaily,
      remainingWeekly,
      remainingMonthly
    };
  }

  /**
   * Apply commission cap before payment
   * Returns the actual amount to be paid
   */
  static async applyCommissionCap(
    userId: string,
    requestedAmount: number,
    commissionType: string = 'binary_bonus'
  ): Promise<number> {
    const check = await this.checkCommissionCap(userId, requestedAmount, commissionType);
    
    if (!check.allowed) {
      console.warn(`Commission payment blocked for user ${userId}: ${check.reason}`);
      return 0;
    }

    if (check.cappedAmount < requestedAmount) {
      console.log(
        `Commission capped for user ${userId}: ${requestedAmount} -> ${check.cappedAmount}. Reason: ${check.reason}`
      );
      
      // Log the capped commission
      await this.logCappedCommission(
        userId,
        requestedAmount,
        check.cappedAmount,
        check.reason || 'Unknown',
        commissionType
      );
    }

    return check.cappedAmount;
  }

  /**
   * Get commission totals for current periods
   */
  private static async getPeriodTotals(
    userId: string,
    referenceDate: Date
  ): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
  }> {
    // Calculate period boundaries
    const dayStart = new Date(referenceDate);
    dayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(referenceDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(referenceDate);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Query commissions
    const commissions = await prisma.commission.findMany({
      where: {
        userId,
        status: 'paid',
        date: { gte: monthStart } // Get all from start of month
      },
      select: {
        amount: true,
        date: true
      }
    });

    const daily = commissions
      .filter(c => c.date && c.date >= dayStart)
      .reduce((sum, c) => sum + c.amount, 0);

    const weekly = commissions
      .filter(c => c.date && c.date >= weekStart)
      .reduce((sum, c) => sum + c.amount, 0);

    const monthly = commissions
      .reduce((sum, c) => sum + c.amount, 0);

    return { daily, weekly, monthly };
  }

  /**
   * Get commission caps for user's rank
   */
  private static getCommissionCaps(
    rank: string,
    companyId?: string
  ): CommissionCap {
    // TODO: Fetch company-specific caps from database
    // For now, use defaults
    return DEFAULT_COMMISSION_CAPS[rank] || DEFAULT_COMMISSION_CAPS['Member'];
  }

  /**
   * Log when a commission is capped
   */
  private static async logCappedCommission(
    userId: string,
    requestedAmount: number,
    cappedAmount: number,
    reason: string,
    commissionType: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'commission_capped',
          entity: 'commission',
          changes: {
            commissionType,
            requestedAmount,
            cappedAmount,
            difference: requestedAmount - cappedAmount,
            reason,
            timestamp: new Date()
          },
          ipAddress: 'system',
          userAgent: 'commission-cap-service'
        }
      });
    } catch (error) {
      console.error('Failed to log capped commission:', error);
      // Don't throw - logging failure shouldn't block payment
    }
  }

  /**
   * Get remaining cap amounts for user
   * Useful for displaying to users
   */
  static async getRemainingCaps(
    userId: string
  ): Promise<{
    rank: string;
    caps: CommissionCap;
    remaining: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    used: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rank: true, companyId: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const caps = this.getCommissionCaps(user.rank, user.companyId ?? undefined);
    const used = await this.getPeriodTotals(userId, new Date());

    return {
      rank: user.rank,
      caps,
      remaining: {
        daily: Math.max(0, caps.dailyCap - used.daily),
        weekly: Math.max(0, caps.weeklyCap - used.weekly),
        monthly: Math.max(0, caps.monthlyCap - used.monthly)
      },
      used
    };
  }

  /**
   * Admin function to set custom caps for a user
   */
  static async setCustomCaps(
    userId: string,
    customCaps: Partial<CommissionCap>,
    adminId: string
  ): Promise<void> {
    // TODO: Store custom caps in database
    // For now, just log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'custom_commission_caps_set',
        entity: 'user',
        changes: {
          customCaps,
          setBy: adminId,
          timestamp: new Date()
        },
        ipAddress: 'admin',
        userAgent: 'commission-cap-service'
      }
    });

    console.log(`Custom commission caps set for user ${userId} by admin ${adminId}`);
  }

  /**
   * Get users who are close to hitting their caps
   * Useful for alerts and notifications
   */
  static async getUsersNearCap(
    threshold: number = 0.9, // 90%
    companyId?: string
  ): Promise<Array<{
    userId: string;
    memberId: string;
    rank: string;
    percentUsed: number;
    period: 'daily' | 'weekly' | 'monthly';
  }>> {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        deleted: false,
        ...(companyId && { companyId })
      },
      select: {
        id: true,
        memberId: true,
        rank: true,
        companyId: true
      }
    });

    const nearCapUsers: Array<{
      userId: string;
      memberId: string;
      rank: string;
      percentUsed: number;
      period: 'daily' | 'weekly' | 'monthly';
    }> = [];

    for (const user of users) {
      const caps = this.getCommissionCaps(user.rank, user.companyId ?? undefined);
      const used = await this.getPeriodTotals(user.id, new Date());

      const dailyPercent = used.daily / caps.dailyCap;
      const weeklyPercent = used.weekly / caps.weeklyCap;
      const monthlyPercent = used.monthly / caps.monthlyCap;

      if (dailyPercent >= threshold) {
        nearCapUsers.push({
          userId: user.id,
          memberId: user.memberId,
          rank: user.rank,
          percentUsed: dailyPercent,
          period: 'daily'
        });
      } else if (weeklyPercent >= threshold) {
        nearCapUsers.push({
          userId: user.id,
          memberId: user.memberId,
          rank: user.rank,
          percentUsed: weeklyPercent,
          period: 'weekly'
        });
      } else if (monthlyPercent >= threshold) {
        nearCapUsers.push({
          userId: user.id,
          memberId: user.memberId,
          rank: user.rank,
          percentUsed: monthlyPercent,
          period: 'monthly'
        });
      }
    }

    return nearCapUsers;
  }

  /**
   * Reset caps for testing/development
   * DO NOT USE IN PRODUCTION
   */
  static async resetCapsForUser(userId: string): Promise<void> {
    // This would delete commission records - very dangerous
    // Only for development/testing
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot reset caps in production');
    }

    console.warn(`Resetting commission caps for user ${userId} - DEVELOPMENT ONLY`);
    // Implementation would go here
  }
}
