import { prisma } from '@/lib/prisma';
import { WalletService } from './wallet-service';
import { realtimeService } from './realtime-service';
import { blockchainAuditService } from './blockchain-audit-service';
import { logger } from '@/lib/logger';

export interface CommissionData {
  id: string;
  userId: string;
  amount: number;
  type: string;
  status: 'Pending' | 'Paid' | 'Cancelled';
  description?: string;
  createdAt: Date;
}

export class CommissionService {
  /**
   * Create a commission entry
   */
  static async createCommission(
    userId: string,
    amount: number,
    type: string,
    description?: string,
    companyId?: string
  ): Promise<CommissionData> {
    const commission = await prisma.commission.create({
      data: {
        userId,
        amount,
        type,
        status: 'Pending',
        companyId
      }
    });

    return {
      id: commission.id,
      userId: commission.userId,
      amount: commission.amount,
      type: commission.type,
      status: commission.status as any,
      description: description || undefined,
      createdAt: commission.date
    };
  }

  /**
   * Pay commission to wallet
   */
  static async payCommission(commissionId: string): Promise<CommissionData> {
    const commission = await prisma.commission.findUnique({
      where: { id: commissionId }
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    if (commission.status !== 'Pending') {
      throw new Error('Commission already processed');
    }

    // Pay to wallet
    await WalletService.creditWallet(
      commission.userId,
      commission.amount,
      `Commission payment: ${commission.type}`,
      commission.id,
      'commission'
    );

    // Update commission status
    const updatedCommission = await prisma.commission.update({
      where: { id: commissionId },
      data: { status: 'Paid' }
    });

    // Log to blockchain audit trail (immutable record)
    try {
      await blockchainAuditService.logFinancialTransaction(
        commission.userId,
        commission.companyId || 'global',
        'COMMISSION_PAYMENT',
        commission.amount,
        {
          commissionId: commission.id,
          commissionType: commission.type,
          description: `Commission payment for commission ${commission.id}`,
          transactionId: `commission-${commission.id}-${Date.now()}`,
          regulatory: true,
          immutable: true
        }
      );
    } catch (error) {
      logger.error('Failed to log commission to blockchain audit:', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with payment even if audit logging fails
    }

    // Send real-time notification
    try {
      await realtimeService.notifyCommission(commission.userId, {
        id: updatedCommission.id,
        amount: updatedCommission.amount,
        type: updatedCommission.type,
        description: `Commission payment processed`,
        paidAt: new Date()
      }, commission.companyId || undefined);
    } catch (error) {
      console.error('Failed to send commission notification:', error);
      // Don't fail the commission payment if notification fails
    }

    return {
      id: updatedCommission.id,
      userId: updatedCommission.userId,
      amount: updatedCommission.amount,
      type: updatedCommission.type,
      status: updatedCommission.status as any,
      description: undefined,
      createdAt: updatedCommission.date
    };
  }

  /**
   * Get user's commissions
   */
  static async getUserCommissions(
    userId: string,
    status?: 'Pending' | 'Paid' | 'Cancelled',
    limit: number = 50
  ): Promise<CommissionData[]> {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const commissions = await prisma.commission.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit
    });

    return commissions.map(commission => ({
      id: commission.id,
      userId: commission.userId,
      amount: commission.amount,
      type: commission.type,
      status: commission.status as any,
      description: undefined,
      createdAt: commission.date
    }));
  }

  /**
   * Calculate binary commissions for a user
   */
  static async calculateBinaryCommission(userId: string): Promise<number> {
    // This is a simplified calculation - in reality this would be much more complex
    // involving genealogy tree traversal and volume calculations

    // Get user's team volumes (simplified)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sponsored: {
          include: {
            sponsored: true // Get downline
          }
        }
      }
    });

    if (!user) return 0;

    // Simplified: Calculate 10% of weaker leg volume
    // In reality, this would involve complex PV tracking and flushing
    let leftVolume = 0;
    let rightVolume = 0;

    // This is a very simplified calculation
    // Real implementation would traverse the entire tree
    const calculateVolume = (members: any[], depth = 0): number => {
      if (depth > 10) return 0; // Prevent infinite recursion
      return members.reduce((total, member) => {
        return total + member.pv + calculateVolume(member.sponsored || [], depth + 1);
      }, 0);
    };

    // Assume first child is left, second is right (simplified)
    if (user.sponsored && user.sponsored.length > 0) {
      leftVolume = calculateVolume([user.sponsored[0]]);
    }
    if (user.sponsored && user.sponsored.length > 1) {
      rightVolume = calculateVolume([user.sponsored[1]]);
    }

    const weakerLeg = Math.min(leftVolume, rightVolume);
    const commission = weakerLeg * 0.10; // 10% binary commission

    return commission;
  }

  /**
   * Run commission cycle for all eligible users
   */
  static async runCommissionCycle(companyId?: string): Promise<{
    processed: number;
    totalAmount: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      totalAmount: 0,
      errors: [] as string[]
    };

    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: {
          active: true,
          ...(companyId && { companyId })
        }
      });

      for (const user of users) {
        try {
          const commissionAmount = await this.calculateBinaryCommission(user.id);

          if (commissionAmount > 0) {
            // Create commission
            const commission = await this.createCommission(
              user.id,
              commissionAmount,
              'Binary Commission',
              `Monthly binary commission for ${new Date().toLocaleDateString()}`,
              companyId
            );

            // Pay commission immediately (in production, this might be batched)
            await this.payCommission(commission.id);

            result.processed++;
            result.totalAmount += commissionAmount;
          }
        } catch (error) {
          result.errors.push(`Failed to process user ${user.id}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Commission cycle failed: ${error}`);
    }

    return result;
  }

  /**
   * Calculate commissions for an order (called from queue)
   */
  static async calculateCommissionsForOrder(orderId: string, userId: string, totalPV: number): Promise<void> {
    try {
      // Simplified commission calculation for order
      // In a real system, this would involve complex genealogy traversal
      // and business rule evaluation

      // For now, create a simple retail profit commission
      const retailProfit = totalPV * 0.05; // 5% retail profit

      if (retailProfit > 0) {
        await this.createCommission(
          userId,
          retailProfit,
          'Retail Profit',
          `Retail profit commission for order ${orderId}`,
          undefined // companyId
        );
      }

      // In a full implementation, this would:
      // 1. Traverse the genealogy tree
      // 2. Calculate binary commissions
      // 3. Apply matching bonuses
      // 4. Check rank qualifications
      // 5. Apply business rules

    } catch (error) {
      console.error('Failed to calculate commissions for order:', error);
      throw error;
    }
  }

  /**
   * Get commission statistics
   */
  static async getCommissionStats(companyId?: string): Promise<{
    totalPaid: number;
    totalPending: number;
    totalUsers: number;
    averageCommission: number;
  }> {
    const where = companyId ? { companyId } : {};

    const [paidStats, pendingStats, userCount] = await Promise.all([
      prisma.commission.aggregate({
        where: { ...where, status: 'Paid' },
        _sum: { amount: true },
        _count: true
      }),
      prisma.commission.aggregate({
        where: { ...where, status: 'Pending' },
        _sum: { amount: true }
      }),
      prisma.user.count({
        where: { ...where, active: true }
      })
    ]);

    const totalPaid = paidStats._sum.amount || 0;
    const totalPending = pendingStats._sum.amount || 0;
    const averageCommission = paidStats._count > 0 ? totalPaid / paidStats._count : 0;

    return {
      totalPaid,
      totalPending,
      totalUsers: userCount,
      averageCommission
    };
  }
}