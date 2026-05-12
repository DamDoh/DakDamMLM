import { paymentDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';
import { WalletService } from './WalletService';

interface PayoutRequestData {
  userId: string;
  amount: number;
  method: string;
  accountDetails: any;
}

interface PayoutQuery {
  page: number;
  limit: number;
  status?: string;
  userId?: string;
}

interface AnalyticsQuery {
  period: string;
  startDate?: string;
  endDate?: string;
}

export class PayoutService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async requestPayout(payoutData: PayoutRequestData) {
    const { userId, amount, method, accountDetails } = payoutData;

    if (amount <= 0) {
      throw new Error('Payout amount must be positive');
    }

    // Check wallet balance
    const wallet = await this.walletService.getWallet(userId);
    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance for payout');
    }

    // Check minimum payout amount (configurable)
    const minPayoutAmount = 10; // $10 minimum
    if (amount < minPayoutAmount) {
      throw new Error(`Minimum payout amount is $${minPayoutAmount}`);
    }

    // Calculate fees (configurable)
    const feeRate = 0.05; // 5% fee
    const fixedFee = 2.50; // $2.50 fixed fee
    const fees = (amount * feeRate) + fixedFee;
    const netAmount = amount - fees;

    // Create payout request
    const payoutRequest = await (db as any).payoutRequest.create({
      data: {
        userId,
        amount,
        method: method as any,
        accountDetails,
        fees,
        netAmount,
        status: 'PENDING',
      },
    });

    // Hold the amount in wallet
    await this.walletService.holdAmount(
      userId,
      amount,
      `Payout request ${payoutRequest.id}`,
      payoutRequest.id
    );

    logger.info('Payout request created', {
      payoutId: payoutRequest.id,
      userId,
      amount,
      method,
      fees,
      netAmount,
    });

    return payoutRequest;
  }

  async getPayoutRequests(query: PayoutQuery) {
    const { page, limit, status, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [payouts, total] = await Promise.all([
      (db as any).payoutRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              memberId: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      (db as any).payoutRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      payouts,
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

  async getPayoutRequestById(payoutId: string) {
    // Try cache first
    let payout = await cacheService.getCachedPayout(payoutId);
    if (payout) {
      return payout;
    }

    // Fetch from database
    payout = await (db as any).payoutRequest.findUnique({
      where: { id: payoutId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            memberId: true,
          },
        },
      },
    });

    if (payout) {
      // Cache for future requests
      await cacheService.setCachedPayout(payoutId, payout);
    }

    return payout;
  }

  async approvePayout(payoutId: string, notes?: string) {
    const payout = await (db as any).payoutRequest.findUnique({
      where: { id: payoutId },
      include: { user: true },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status !== 'PENDING') {
      throw new Error(`Payout request is already ${payout.status.toLowerCase()}`);
    }

    const updatedPayout = await (db as any).payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
        notes,
      },
    });

    // Invalidate cache
    await cacheService.invalidatePayoutCache(payoutId);

    logger.info('Payout request approved', {
      payoutId,
      userId: payout.userId,
      amount: payout.amount,
    });

    return updatedPayout;
  }

  async rejectPayout(payoutId: string, reason: string) {
    const payout = await (db as any).payoutRequest.findUnique({
      where: { id: payoutId },
      include: { user: true },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status !== 'PENDING') {
      throw new Error(`Payout request is already ${payout.status.toLowerCase()}`);
    }

    const updatedPayout = await (db as any).payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: 'REJECTED',
        failureReason: reason,
        failedAt: new Date(),
      },
    });

    // Release the hold on wallet
    await this.walletService.releaseHold(
      payout.userId,
      payout.amount,
      `Payout rejected: ${reason}`,
      payoutId
    );

    // Invalidate cache
    await cacheService.invalidatePayoutCache(payoutId);

    logger.info('Payout request rejected', {
      payoutId,
      userId: payout.userId,
      amount: payout.amount,
      reason,
    });

    return updatedPayout;
  }

  async processPayout(payoutId: string) {
    const payout = await (db as any).payoutRequest.findUnique({
      where: { id: payoutId },
      include: { user: true },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status !== 'APPROVED') {
      throw new Error('Payout request must be approved before processing');
    }

    try {
      // Process payout with payment provider (simplified)
      const processedPayout = await this.processPayoutWithProvider(payout);

      // Debit from wallet
      await this.walletService.debitWallet(
        payout.userId,
        {
          amount: payout.amount,
          description: `Payout processed: ${payoutId}`,
          referenceId: payoutId,
          referenceType: 'payout',
        }
      );

      // Update payout status
      const updatedPayout = await (db as any).payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          completedAt: new Date(),
          transactionId: processedPayout.transactionId,
        },
      });

      // Invalidate cache
      await cacheService.invalidatePayoutCache(payoutId);

      logger.info('Payout processed successfully', {
        payoutId,
        userId: payout.userId,
        amount: payout.amount,
        method: payout.method,
        transactionId: processedPayout.transactionId,
      });

      return updatedPayout;
    } catch (error) {
      // Update payout status to failed
      await (db as any).payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: (error as Error).message,
        },
      });

      // Release the hold on wallet
      await this.walletService.releaseHold(
        payout.userId,
        payout.amount,
        `Payout failed: ${(error as Error).message}`,
        payoutId
      );

      throw error;
    }
  }

  async processCommissionPayout(commissionId: string, userId: string, amount: number) {
    // This would typically be called by the commission service
    // For now, we'll credit the wallet directly

    const result = await this.walletService.creditWallet(userId, {
      amount,
      description: `Commission payout for ${commissionId}`,
      referenceId: commissionId,
      referenceType: 'commission',
    });

    logger.info('Commission payout processed', {
      commissionId,
      userId,
      amount,
    });

    return result;
  }

  async getPayoutAnalytics(query: AnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query);

    const [payoutStats, methodStats, pendingPayouts] = await Promise.all([
      // Payout status distribution
      (db as any).payoutRequest.groupBy({
        by: ['status'],
        where: {
          requestedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          amount: true,
          fees: true,
        },
      }),
      // Payout method distribution
      (db as any).payoutRequest.groupBy({
        by: ['method'],
        where: {
          requestedAt: {
            gte: startDate,
            lte: endDate,
          },
          status: 'COMPLETED',
        },
        _count: true,
        _sum: {
          netAmount: true,
        },
      }),
      // Count pending payouts
      (db as any).payoutRequest.count({
        where: {
          status: 'PENDING',
        },
      }),
    ]);

    const statusDistribution = payoutStats.reduce((acc: Record<string, { count: number; volume: number; fees: number }>, stat: any) => {
      acc[stat.status] = {
        count: stat._count,
        volume: stat._sum.amount || 0,
        fees: stat._sum.fees || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; volume: number; fees: number }>);

    const methodDistribution = methodStats.reduce((acc: Record<string, { count: number; volume: number }>, stat: any) => {
      acc[stat.method] = {
        count: stat._count,
        volume: stat._sum.netAmount || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; volume: number }>);

    const totalVolume = payoutStats.reduce((sum: number, stat: any) => sum + (stat._sum.amount || 0), 0);
    const totalFees = payoutStats.reduce((sum: number, stat: any) => sum + (stat._sum.fees || 0), 0);

    return {
      period: query.period,
      startDate,
      endDate,
      totalPayouts: payoutStats.reduce((sum: number, stat: any) => sum + stat._count, 0),
      totalVolume,
      totalFees,
      netVolume: totalVolume - totalFees,
      pendingPayouts,
      statusDistribution,
      methodDistribution,
    };
  }

  private async processPayoutWithProvider(payout: any) {
    // Simulate payout processing with different providers
    // In a real implementation, this would integrate with banking APIs, PayPal, etc.

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 200));

      // Simulate success/failure (95% success rate for payouts)
      const isSuccess = Math.random() > 0.05;

      if (isSuccess) {
        return {
          transactionId: `PT_${payout.id}_${Date.now()}`,
          status: 'COMPLETED',
          processedAt: new Date(),
        };
      } else {
        throw new Error('Payout processing failed');
      }
    } catch (error) {
      throw new Error(`Payout provider error: ${(error as Error).message}`);
    }
  }

  private getDateRange(query: AnalyticsQuery): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      switch (query.period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
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
    }

    return { startDate, endDate };
  }
}