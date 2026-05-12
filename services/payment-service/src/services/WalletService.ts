import { paymentDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';

interface WalletTransactionData {
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
}

export class WalletService {
  async getWallet(userId: string) {
    // Try cache first
    let wallet = await cacheService.getCachedWallet(userId);
    if (wallet) {
      return wallet;
    }

    // Fetch from database
    wallet = await db.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await db.wallet.create({
        data: {
          userId,
          balance: 0,
          currency: 'USD',
          isActive: true,
        },
      });
    }

    // Cache the wallet
    await cacheService.setCachedWallet(userId, wallet);

    return wallet;
  }

  async creditWallet(userId: string, transactionData: WalletTransactionData) {
    const { amount, description, referenceId, referenceType } = transactionData;

    if (amount <= 0) {
      throw new Error('Credit amount must be positive');
    }

    // Get current wallet
    const wallet = await this.getWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    // Update wallet balance
    const updatedWallet = await db.wallet.update({
      where: { userId },
      data: {
        balance: balanceAfter,
        updatedAt: new Date(),
      },
    });

    // Create wallet transaction record
    await db.walletTransaction.create({
      data: {
        walletId: updatedWallet.id,
        ...({ userId } as any),
        type: 'CREDIT',
        amount,
        balanceBefore,
        balanceAfter,
        description,
        referenceId,
        referenceType,
      },
    });

    // Update cache
    await cacheService.setCachedWallet(userId, updatedWallet);

    logger.info('Wallet credited', {
      userId,
      amount,
      balanceBefore,
      balanceAfter,
      description,
    });

    return {
      wallet: updatedWallet,
      transaction: {
        type: 'CREDIT',
        amount,
        balanceBefore,
        balanceAfter,
        description,
      },
    };
  }

  async debitWallet(userId: string, transactionData: WalletTransactionData) {
    const { amount, description, referenceId, referenceType } = transactionData;

    if (amount <= 0) {
      throw new Error('Debit amount must be positive');
    }

    // Get current wallet
    const wallet = await this.getWallet(userId);
    const balanceBefore = wallet.balance;

    if (balanceBefore < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const balanceAfter = balanceBefore - amount;

    // Update wallet balance
    const updatedWallet = await db.wallet.update({
      where: { userId },
      data: {
        balance: balanceAfter,
        updatedAt: new Date(),
      },
    });

    // Create wallet transaction record
    await db.walletTransaction.create({
      data: {
        walletId: updatedWallet.id,
        ...({ userId } as any),
        type: 'DEBIT',
        amount,
        balanceBefore,
        balanceAfter,
        description,
        referenceId,
        referenceType,
      },
    });

    // Update cache
    await cacheService.setCachedWallet(userId, updatedWallet);

    logger.info('Wallet debited', {
      userId,
      amount,
      balanceBefore,
      balanceAfter,
      description,
    });

    return {
      wallet: updatedWallet,
      transaction: {
        type: 'DEBIT',
        amount,
        balanceBefore,
        balanceAfter,
        description,
      },
    };
  }

  async getWalletTransactions(userId: string, page: number = 1, limit: number = 10, type?: string) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.walletTransaction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      transactions,
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

  async getWalletBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet.balance;
  }

  async holdAmount(userId: string, amount: number, description: string, referenceId?: string) {
    // Get current wallet
    const wallet = await this.getWallet(userId);
    const balanceBefore = wallet.balance;

    if (balanceBefore < amount) {
      throw new Error('Insufficient wallet balance for hold');
    }

    // Update pending amount (if field exists in schema)
    const updatedWallet = await db.wallet.update({
      where: { userId },
      data: {
        ...({ pendingAmount: { increment: amount } } as any),
        updatedAt: new Date(),
      },
    });

    // Create hold transaction record
    await db.walletTransaction.create({
      data: {
        walletId: updatedWallet.id,
        ...({ userId } as any),
        type: 'HOLD',
        amount,
        balanceBefore,
        balanceAfter: balanceBefore, // Balance doesn't change for holds
        description,
        referenceId,
        referenceType: 'hold',
      },
    });

    // Update cache
    await cacheService.setCachedWallet(userId, updatedWallet);

    logger.info('Amount held in wallet', {
      userId,
      amount,
      description,
    });

    return updatedWallet;
  }

  async releaseHold(userId: string, amount: number, description: string, referenceId?: string) {
    // Get current wallet
    const wallet = await this.getWallet(userId);

    if (wallet.pendingAmount < amount) {
      throw new Error('Insufficient pending amount to release');
    }

    // Update pending amount (if field exists in schema)
    const updatedWallet = await db.wallet.update({
      where: { userId },
      data: {
        ...({ pendingAmount: { decrement: amount } } as any),
        updatedAt: new Date(),
      },
    });

    // Create release transaction record
    await db.walletTransaction.create({
      data: {
        walletId: updatedWallet.id,
        ...({ userId } as any),
        type: 'RELEASE',
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // Balance doesn't change for releases
        description,
        referenceId,
        referenceType: 'release',
      },
    });

    // Update cache
    await cacheService.setCachedWallet(userId, updatedWallet);

    logger.info('Hold released from wallet', {
      userId,
      amount,
      description,
    });

    return updatedWallet;
  }

  async getWalletAnalytics() {
    const [walletStats, transactionStats, topEarners] = await Promise.all([
      // Wallet statistics
      db.wallet.aggregate({
        _count: true,
        _sum: {
          balance: true,
        },
      }),
      // Transaction statistics
      db.walletTransaction.groupBy({
        by: ['type'],
        _count: true,
        _sum: {
          amount: true,
        },
      }),
      // Top earners (by balance)
      db.wallet.findMany({
        select: {
          userId: true,
          balance: true,
        },
        orderBy: {
          balance: 'desc',
        },
        take: 10,
      }),
    ]);

    const transactionSummary = transactionStats.reduce((acc: Record<string, { count: number; volume: number }>, stat: { type: string; _count: number; _sum: { amount: number | null } }) => {
      acc[stat.type] = {
        count: stat._count,
        volume: stat._sum.amount || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; volume: number }>);

    return {
      totalWallets: walletStats._count || 0,
      totalBalance: walletStats._sum?.balance || 0,
      averageBalance: (walletStats._count && walletStats._count > 0) ? ((walletStats._sum?.balance || 0) / walletStats._count) : 0,
      transactionSummary,
      topEarners: topEarners.map((earner: { userId: string; balance: number }) => ({
        userId: earner.userId,
        currentBalance: earner.balance,
      })),
    };
  }

  async transferBetweenWallets(fromUserId: string, toUserId: string, amount: number, description: string) {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    // Check sender balance
    const senderWallet = await this.getWallet(fromUserId);
    if (senderWallet.balance < amount) {
      throw new Error('Insufficient balance for transfer');
    }

    // Debit from sender
    await this.debitWallet(fromUserId, {
      amount,
      description: `Transfer to ${toUserId}: ${description}`,
      referenceId: toUserId,
      referenceType: 'transfer_out',
    });

    // Credit to receiver
    await this.creditWallet(toUserId, {
      amount,
      description: `Transfer from ${fromUserId}: ${description}`,
      referenceId: fromUserId,
      referenceType: 'transfer_in',
    });

    logger.info('Wallet transfer completed', {
      fromUserId,
      toUserId,
      amount,
      description,
    });

    return {
      fromWallet: await this.getWallet(fromUserId),
      toWallet: await this.getWallet(toUserId),
    };
  }
}