import { commissionDb } from '../config/database';
import { cacheService } from '../utils/cache';
import { queueService } from '../utils/queue';
import { logger, logPayoutProcessed, logPayoutError } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface PayoutQuery {
  page: number;
  limit: number;
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
}

interface PayoutAnalyticsQuery {
  period: string;
  startDate?: string;
  endDate?: string;
}

export class PayoutService {
  async createPayout(payoutData: any) {
    const { userId, amount, method, reference } = payoutData;

    // Calculate fees based on method
    const fees = this.calculateFees(amount, method);
    const netAmount = amount - fees;

    const payout = await (commissionDb as any).commissionPayout.create({
      data: {
        userId,
        amount,
        method: method as any,
        status: 'PENDING',
        reference,
        fees,
        netAmount,
      },
    });

    // Queue payout processing
    await this.queuePayoutProcessing(payout);

    logger.info('Payout created', {
      payoutId: payout.id,
      userId,
      amount,
      method,
      netAmount,
    });

    return payout;
  }

  async getPayouts(query: PayoutQuery) {
    const { page, limit, status, method, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (method) where.method = method;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [payouts, total] = await Promise.all([
      (commissionDb as any).commissionPayout.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              memberId: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (commissionDb as any).commissionPayout.count({ where }),
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

  async getPayoutById(payoutId: string) {
    return await (commissionDb as any).commissionPayout.findUnique({
      where: { id: payoutId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            memberId: true,
            email: true,
          },
        },
      },
    });
  }

  async getUserPayouts(userId: string, page: number = 1, limit: number = 10, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;

    const [payouts, total] = await Promise.all([
      (commissionDb as any).commissionPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (commissionDb as any).commissionPayout.count({ where }),
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

  async updatePayoutStatus(payoutId: string, status: string) {
    const updateData: any = {
      status: status as any,
      updatedAt: new Date(),
    };

    if (status === 'COMPLETED') {
      updateData.paidAt = new Date();
    } else if (status === 'PROCESSING') {
      updateData.processedAt = new Date();
    }

    const payout = await (commissionDb as any).commissionPayout.update({
      where: { id: payoutId },
      data: updateData,
    });

    // Invalidate cache
    await cacheService.invalidateUserPayoutsCache(payout.userId);

    logger.info('Payout status updated', {
      payoutId,
      userId: payout.userId,
      oldStatus: payout.status,
      newStatus: status,
    });

    return payout;
  }

  async processPayout(payoutId: string) {
    const payout = await this.getPayoutById(payoutId);
    if (!payout) {
      throw new Error('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new Error(`Payout is already ${payout.status.toLowerCase()}`);
    }

    try {
      // Update status to processing
      await this.updatePayoutStatus(payoutId, 'PROCESSING');

      // Process based on method
      const result = await this.processPayoutByMethod(payout);

      if (result.success) {
        await this.updatePayoutStatus(payoutId, 'COMPLETED');
        logPayoutProcessed(payout.userId, payoutId, payout.amount, 'COMPLETED');
      } else {
        await this.updatePayoutStatus(payoutId, 'FAILED');
        logPayoutError(payout.userId, payoutId, result.error || 'Processing failed');
      }

      return result;
    } catch (error) {
      await this.updatePayoutStatus(payoutId, 'FAILED');
      logPayoutError(payout.userId, payoutId, (error as Error).message);
      throw error;
    }
  }

  async getPayoutAnalytics(query: PayoutAnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query.period);

    const [stats, methodStats, statusStats, monthlyTrends] = await Promise.all([
      // Overall statistics
      (commissionDb as any).commissionPayout.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          amount: true,
          fees: true,
          netAmount: true,
        },
      }),
      // By method
      (commissionDb as any).commissionPayout.groupBy({
        by: ['method'],
        where: {
          createdAt: {
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
      // By status
      (commissionDb as any).commissionPayout.groupBy({
        by: ['status'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          amount: true,
        },
      }),
      // Monthly trends
      this.getMonthlyPayoutTrends(startDate, endDate),
    ]);

    const totalPayouts = stats._count;
    const totalAmount = stats._sum.amount || 0;
    const totalFees = stats._sum.fees || 0;
    const totalNetAmount = stats._sum.netAmount || 0;

    const payoutsByMethod = methodStats.map((stat: typeof methodStats[number]) => ({
      method: stat.method,
      count: stat._count,
      amount: stat._sum?.amount || 0,
      fees: stat._sum?.fees || 0,
    }));

    const payoutsByStatus = statusStats.map((stat: typeof statusStats[number]) => ({
      status: stat.status,
      count: stat._count,
      amount: stat._sum?.amount || 0,
    }));

    const successfulPayouts = payoutsByStatus.find((s: typeof payoutsByStatus[number]) => s.status === 'COMPLETED')?.count || 0;
    const failedPayouts = payoutsByStatus.find((s: typeof payoutsByStatus[number]) => s.status === 'FAILED')?.count || 0;

    const successRate = totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 0;
    const averageProcessingTime = await this.calculateAverageProcessingTime(startDate, endDate);

    return {
      period: query.period,
      startDate,
      endDate,
      totalPayouts,
      totalAmount,
      totalFees,
      totalNetAmount,
      successfulPayouts,
      failedPayouts,
      successRate,
      averageProcessingTime,
      payoutsByMethod,
      payoutsByStatus,
      monthlyTrends,
    };
  }

  private calculateFees(amount: number, method: string): number {
    // Fee calculation based on method
    switch (method) {
      case 'BANK_TRANSFER':
        return Math.max(10, amount * 0.01); // $10 minimum or 1%
      case 'PAYPAL':
        return amount * 0.029 + 0.30; // PayPal fees
      case 'WIRE_TRANSFER':
        return Math.max(25, amount * 0.005); // $25 minimum or 0.5%
      case 'CRYPTO':
        return amount * 0.02; // 2% crypto fees
      case 'GIFT_CARD':
        return amount * 0.05; // 5% gift card fees
      default:
        return 0;
    }
  }

  private async processPayoutByMethod(payout: any) {
    // This would integrate with actual payment processors
    // For now, simulate processing based on method

    switch (payout.method) {
      case 'BANK_TRANSFER':
        return await this.processBankTransfer(payout);
      case 'PAYPAL':
        return await this.processPayPal(payout);
      case 'WIRE_TRANSFER':
        return await this.processWireTransfer(payout);
      case 'CRYPTO':
        return await this.processCrypto(payout);
      case 'GIFT_CARD':
        return await this.processGiftCard(payout);
      default:
        throw new Error(`Unsupported payout method: ${payout.method}`);
    }
  }

  private async processBankTransfer(payout: any) {
    // Simulate bank transfer processing
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

    // 95% success rate
    const success = Math.random() > 0.05;

    return {
      success,
      reference: success ? `BT${Date.now()}` : null,
      error: success ? null : 'Bank transfer failed',
    };
  }

  private async processPayPal(payout: any) {
    // Simulate PayPal processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    const success = Math.random() > 0.03; // 97% success rate

    return {
      success,
      reference: success ? `PP${Date.now()}` : null,
      error: success ? null : 'PayPal transfer failed',
    };
  }

  private async processWireTransfer(payout: any) {
    // Simulate wire transfer processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    const success = Math.random() > 0.02; // 98% success rate

    return {
      success,
      reference: success ? `WT${Date.now()}` : null,
      error: success ? null : 'Wire transfer failed',
    };
  }

  private async processCrypto(payout: any) {
    // Simulate crypto processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const success = Math.random() > 0.10; // 90% success rate

    return {
      success,
      reference: success ? `CR${Date.now()}` : null,
      error: success ? null : 'Crypto transfer failed',
    };
  }

  private async processGiftCard(payout: any) {
    // Simulate gift card processing
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = Math.random() > 0.01; // 99% success rate

    return {
      success,
      reference: success ? `GC${Date.now()}` : null,
      error: success ? null : 'Gift card generation failed',
    };
  }

  private async queuePayoutProcessing(payout: any) {
    await queueService.publishPayoutProcessing({
      id: uuidv4(),
      type: 'payout_processing',
      data: {
        payoutId: payout.id,
        userId: payout.userId,
        amount: payout.amount,
        method: payout.method,
      },
    });
  }

  private async getMonthlyPayoutTrends(startDate: Date, endDate: Date) {
    // This would be a complex query to get monthly trends
    // For now, return a simplified structure
    const months = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

      const monthStats = await (commissionDb as any).commissionPayout.aggregate({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _count: true,
        _sum: {
          amount: true,
        },
      });

      months.push({
        month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
        payoutCount: monthStats._count,
        payoutAmount: monthStats._sum.amount || 0,
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  private async calculateAverageProcessingTime(startDate: Date, endDate: Date): Promise<number> {
    // Calculate average time between creation and completion
    const completedPayouts = await (commissionDb as any).commissionPayout.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        paidAt: {
          not: null,
        },
      },
      select: {
        createdAt: true,
        paidAt: true,
      },
    });

    if (completedPayouts.length === 0) return 0;

    const totalTime = completedPayouts.reduce((sum: number, payout: typeof completedPayouts[number]) => {
      const processingTime = payout.paidAt!.getTime() - payout.createdAt.getTime();
      return sum + processingTime;
    }, 0);

    // Return average in hours
    return (totalTime / completedPayouts.length) / (1000 * 60 * 60);
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
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

    return { startDate, endDate };
  }
}