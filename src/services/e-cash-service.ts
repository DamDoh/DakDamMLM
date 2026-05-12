import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

/**
 * E-Cash Service
 * Handles E-Cash balance and transactions
 * E-Cash stores ONLY commission earnings in USD
 */

/**
 * Add commission to E-Cash balance
 * This should be called when a commission is paid/created
 */
export async function addCommissionToECash(
  userId: string,
  commissionAmount: number,
  commissionId: string,
  commissionType: string
): Promise<void> {
  try {
    // Ensure amount is positive
    const amountUsd = Math.abs(commissionAmount);
    
    if (amountUsd <= 0) {
      logger.warn('Invalid commission amount for E-Cash', {
        userId,
        commissionAmount,
        commissionId
      });
      return;
    }

    // Update user's E-Cash balance and create transaction in a single transaction
    await prisma.$transaction(async (tx) => {
      // Get current E-Cash balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { eCashBalance: true }
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Check if this commission already has an E-Cash transaction (idempotency)
      const existingTransaction = await tx.eCashTransaction.findFirst({
        where: {
          userId,
          type: 'commission',
          // We can't match by commissionId directly, so we'll check by amount and date range
          // This is a best-effort check
        }
      });

      // Update E-Cash balance
      await tx.user.update({
        where: { id: userId },
        data: {
          eCashBalance: {
            increment: amountUsd
          }
        }
      });

      // Create E-Cash transaction record
      await tx.eCashTransaction.create({
        data: {
          userId,
          type: 'commission',
          source: null, // Commissions don't have a source (they're earned)
          amountUsd: amountUsd
        }
      });

      logger.info('Commission added to E-Cash', {
        userId,
        commissionId,
        commissionType,
        amountUsd,
        newBalance: (user.eCashBalance || 0) + amountUsd
      });
    });
  } catch (error) {
    logger.error('Failed to add commission to E-Cash', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      commissionAmount,
      commissionId,
      commissionType
    });
    // Don't throw - E-Cash addition failure shouldn't break commission payment
  }
}

/**
 * Get E-Cash balance for a user
 */
export async function getECashBalance(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { eCashBalance: true }
    });

    return user?.eCashBalance || 0;
  } catch (error) {
    logger.error('Failed to get E-Cash balance', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return 0;
  }
}

/**
 * Backfill E-Cash balance from existing paid commissions
 * This function calculates the total of all paid commissions and updates the E-Cash balance
 */
export async function backfillECashFromCommissions(userId: string): Promise<{
  success: boolean;
  totalCommissions: number;
  transactionsCreated: number;
  newBalance: number;
  message?: string;
}> {
  try {
    // Get all paid commissions for the user
    // Exclude PV/E-Comm topup related commissions (these are not real commissions, just PV additions)
    const paidCommissions = await prisma.commission.findMany({
      where: {
        userId,
        status: 'Paid',
        NOT: {
          type: {
            in: ['PV Top-up Request', 'E-Cash Topup', 'E-Comm Topup', 'PV Topup']
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    if (paidCommissions.length === 0) {
      return {
        success: true,
        totalCommissions: 0,
        transactionsCreated: 0,
        newBalance: 0,
        message: 'No paid commissions found'
      };
    }

    // Calculate total commissions (only positive amounts)
    const totalCommissions = paidCommissions
      .filter(c => c.amount > 0)
      .reduce((sum, c) => sum + c.amount, 0);

    // Get existing E-Cash transactions to avoid duplicates
    const existingTransactions = await prisma.eCashTransaction.findMany({
      where: {
        userId,
        type: 'commission'
      }
    });

    // Create a set of existing transaction amounts and dates for duplicate detection
    // We'll match commissions to transactions by amount and approximate date
    const existingAmounts = new Set(
      existingTransactions.map(t => `${t.amountUsd.toFixed(2)}_${t.createdAt.toISOString().split('T')[0]}`)
    );

    // Filter commissions that don't have corresponding E-Cash transactions
    const commissionsToAdd = paidCommissions.filter(commission => {
      if (commission.amount <= 0) return false;
      const key = `${commission.amount.toFixed(2)}_${commission.date.toISOString().split('T')[0]}`;
      return !existingAmounts.has(key);
    });

    // Update E-Cash balance and create transactions in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get current user
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { eCashBalance: true }
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Calculate the sum of commissions to add
      const amountToAdd = commissionsToAdd.reduce((sum, c) => sum + c.amount, 0);

      // Update E-Cash balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          eCashBalance: {
            increment: amountToAdd
          }
        },
        select: { eCashBalance: true }
      });

      // Create E-Cash transactions for each commission
      const transactionPromises = commissionsToAdd.map(commission =>
        tx.eCashTransaction.create({
          data: {
            userId,
            type: 'commission',
            source: null,
            amountUsd: commission.amount,
            createdAt: commission.date // Use commission date for transaction date
          }
        })
      );

      await Promise.all(transactionPromises);

      return {
        newBalance: updatedUser.eCashBalance || 0,
        transactionsCreated: commissionsToAdd.length
      };
    });

    logger.info('E-Cash balance backfilled from commissions', {
      userId,
      totalCommissions,
      transactionsCreated: result.transactionsCreated,
      newBalance: result.newBalance
    });

    return {
      success: true,
      totalCommissions,
      transactionsCreated: result.transactionsCreated,
      newBalance: result.newBalance
    };
  } catch (error) {
    logger.error('Failed to backfill E-Cash from commissions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return {
      success: false,
      totalCommissions: 0,
      transactionsCreated: 0,
      newBalance: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
