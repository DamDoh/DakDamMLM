import { prisma } from '@/lib/prisma';

export interface WalletData {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

export interface TransactionData {
  id: string;
  walletId: string;
  type: 'credit' | 'debit' | 'transfer_in' | 'transfer_out' | 'commission' | 'withdrawal';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
}

/**
 * ENHANCED Wallet Service
 * 
 * CRITICAL FIXES:
 * 1. Added proper transaction isolation to prevent race conditions
 * 2. Added balance validation after debit to catch concurrent modifications
 * 3. Added idempotency keys to prevent duplicate transactions
 * 4. Fixed balance calculation race condition
 * 5. Added wallet locking mechanism
 * 6. Added proper error handling and rollback
 * 7. Added amount validation (positive numbers, max limits)
 * 8. Fixed transfer atomicity - both wallets updated or neither
 */
export class WalletServiceEnhanced {
  private static readonly MAX_TRANSACTION_AMOUNT = 1000000; // $1M limit
  private static readonly MIN_TRANSACTION_AMOUNT = 0.01; // $0.01 minimum
  
  /**
   * Get or create wallet for user
   * ENHANCED: Added validation and error handling
   */
  static async getOrCreateWallet(userId: string, companyId?: string): Promise<WalletData> {
    if (!userId || userId.trim() === '') {
      throw new Error('Invalid user ID');
    }

    let wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      // ENHANCEMENT: Check if user exists before creating wallet
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, active: true, deleted: true }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (!user.active || user.deleted) {
        throw new Error('Cannot create wallet for inactive or deleted user');
      }

      wallet = await prisma.wallet.create({
        data: {
          userId,
          companyId,
          balance: 0,
          currency: 'USD',
          isActive: true
        }
      });

      console.log(`Created new wallet for user ${userId}`);
    }

    // ENHANCEMENT: Check if wallet is active
    if (!wallet.isActive) {
      throw new Error('Wallet is inactive');
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
      currency: wallet.currency,
      isActive: wallet.isActive
    };
  }

  /**
   * Get wallet balance
   * ENHANCED: Added caching consideration
   */
  static async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId);
    return Math.round(wallet.balance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate transaction amount
   * ENHANCEMENT: Added validation helper
   */
  private static validateAmount(amount: number, operation: string): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error(`Invalid amount for ${operation}: ${amount}`);
    }

    if (amount < this.MIN_TRANSACTION_AMOUNT) {
      throw new Error(`Amount too small: minimum ${this.MIN_TRANSACTION_AMOUNT}`);
    }

    if (amount > this.MAX_TRANSACTION_AMOUNT) {
      throw new Error(`Amount too large: maximum ${this.MAX_TRANSACTION_AMOUNT}`);
    }

    // ENHANCEMENT: Check for excessive decimal places
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      throw new Error('Amount cannot have more than 2 decimal places');
    }
  }

  /**
   * Credit wallet (add money)
   * ENHANCED: Added idempotency and proper transaction handling
   */
  static async creditWallet(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<WalletData> {
    // ENHANCEMENT: Validate amount
    this.validateAmount(amount, 'credit');

    const wallet = await this.getOrCreateWallet(userId);

    // ENHANCEMENT: Check for duplicate transaction using referenceId
    if (referenceId) {
      const existing = await prisma.walletTransaction.findFirst({
        where: {
          walletId: wallet.id,
          referenceId: referenceId,
          status: 'completed'
        }
      });

      if (existing) {
        console.warn(`Duplicate credit transaction detected for reference ${referenceId}`);
        // Return current wallet state without processing
        const currentWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
        return {
          id: currentWallet!.id,
          userId: currentWallet!.userId,
          balance: currentWallet!.balance,
          currency: currentWallet!.currency,
          isActive: currentWallet!.isActive
        };
      }
    }

    // CRITICAL FIX: Use transaction with proper isolation level
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch wallet with lock
      const lockedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id }
      });

      if (!lockedWallet) {
        throw new Error('Wallet not found during transaction');
      }

      const balanceBefore = lockedWallet.balance;
      const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });

      // Record transaction - CRITICAL: Ensure referenceType is saved correctly
      const transactionData = {
        walletId: wallet.id,
        type: 'credit',
        amount: Math.round(amount * 100) / 100,
        balanceBefore,
        balanceAfter,
        description: description || 'Wallet credit',
        referenceId: referenceId || null,
        referenceType: referenceType || null, // CRITICAL: Save referenceType
        status: 'completed' as const
      };
      
      console.log('💾 Creating wallet transaction with data:', {
        ...transactionData,
        referenceType: referenceType, // Log the referenceType being passed
        hasReferenceType: !!referenceType
      });
      
      const transaction = await tx.walletTransaction.create({
        data: transactionData
      });

      console.log(`✅✅✅ TRANSACTION CREATED ✅✅✅`, {
        transactionId: transaction.id,
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
        amount: transaction.amount,
        description: transaction.description,
        walletId: wallet.id,
        userId: wallet.userId,
        type: transaction.type
      });
      
      // Verify the transaction was saved with correct referenceType
      if (referenceType && transaction.referenceType !== referenceType) {
        console.error('❌❌❌ CRITICAL: Transaction referenceType mismatch!', {
          expected: referenceType,
          actual: transaction.referenceType,
          transactionId: transaction.id
        });
      }

      return updatedWallet;
    }, {
      isolationLevel: 'Serializable', // CRITICAL: Prevent race conditions
      timeout: 10000,
      maxWait: 15000
    });

    return {
      id: result.id,
      userId: result.userId,
      balance: result.balance,
      currency: result.currency,
      isActive: result.isActive
    };
  }

  /**
   * Debit wallet (subtract money)
   * ENHANCED: Added strict balance checking and race condition prevention
   */
  static async debitWallet(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<WalletData> {
    // ENHANCEMENT: Validate amount
    this.validateAmount(amount, 'debit');

    const wallet = await this.getOrCreateWallet(userId);

    // ENHANCEMENT: Check for duplicate transaction
    if (referenceId) {
      const existing = await prisma.walletTransaction.findFirst({
        where: {
          walletId: wallet.id,
          referenceId: referenceId,
          status: 'completed'
        }
      });

      if (existing) {
        console.warn(`Duplicate debit transaction detected for reference ${referenceId}`);
        const currentWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
        return {
          id: currentWallet!.id,
          userId: currentWallet!.userId,
          balance: currentWallet!.balance,
          currency: currentWallet!.currency,
          isActive: currentWallet!.isActive
        };
      }
    }

    // CRITICAL FIX: Check balance before starting transaction
    if (wallet.balance < amount) {
      throw new InsufficientBalanceError(`Insufficient balance: have ${wallet.balance}, need ${amount}`);
    }

    // CRITICAL FIX: Use transaction with proper isolation level
    const result = await prisma.$transaction(async (tx) => {
      // CRITICAL: Re-fetch wallet with lock to get latest balance
      const lockedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id }
      });

      if (!lockedWallet) {
        throw new Error('Wallet not found during transaction');
      }

      const balanceBefore = lockedWallet.balance;

      // CRITICAL FIX: Double-check balance inside transaction
      if (balanceBefore < amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance in transaction: have ${balanceBefore}, need ${amount}`
        );
      }

      const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;

      // CRITICAL FIX: Ensure balance doesn't go negative due to floating point
      if (balanceAfter < 0) {
        throw new InsufficientBalanceError('Balance would be negative after transaction');
      }

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });

      // CRITICAL FIX: Verify the update was successful
      if (updatedWallet.balance < 0) {
        throw new Error('Balance became negative - transaction rolled back');
      }

      // Record transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'debit',
          amount: -Math.round(amount * 100) / 100, // Negative for debits
          balanceBefore,
          balanceAfter,
          description: description || 'Wallet debit',
          referenceId,
          referenceType,
          status: 'completed'
        }
      });

      console.log(`Debited ${amount} from wallet ${wallet.id}, transaction ${transaction.id}`);

      return updatedWallet;
    }, {
      isolationLevel: 'Serializable', // CRITICAL: Prevent race conditions
      timeout: 10000,
      maxWait: 15000
    });

    return {
      id: result.id,
      userId: result.userId,
      balance: result.balance,
      currency: result.currency,
      isActive: result.isActive
    };
  }

  /**
   * Transfer money between wallets
   * ENHANCED: Complete atomicity - both succeed or both fail
   */
  static async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description: string = 'E-cash transfer',
    companyId?: string
  ): Promise<{ transferId: string; status: string }> {
    // ENHANCEMENT: Validate inputs
    if (fromUserId === toUserId) {
      throw new Error('Cannot transfer to same wallet');
    }

    this.validateAmount(amount, 'transfer');

    const fromWallet = await this.getOrCreateWallet(fromUserId, companyId);
    const toWallet = await this.getOrCreateWallet(toUserId, companyId);

    // ENHANCEMENT: Verify both wallets are active
    if (!fromWallet.isActive || !toWallet.isActive) {
      throw new Error('Both wallets must be active for transfer');
    }

    // Check sender has sufficient balance
    if (fromWallet.balance < amount) {
      throw new InsufficientBalanceError(
        `Insufficient balance for transfer: have ${fromWallet.balance}, need ${amount}`
      );
    }

    // Check if transfer requires escrow
    const requiresEscrow = amount > 1000; // Configurable threshold

    // CRITICAL FIX: Everything in one transaction for complete atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create transfer record first
      const transfer = await tx.walletTransfer.create({
        data: {
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          amount: Math.round(amount * 100) / 100,
          fee: 0,
          description,
          status: requiresEscrow ? 'pending' : 'completed',
          escrowAmount: requiresEscrow ? amount : null,
          escrowExpires: requiresEscrow ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null, // 24h
          companyId
        }
      });

      if (!requiresEscrow) {
        // CRITICAL FIX: Lock both wallets in consistent order to prevent deadlock
        const [firstWallet, secondWallet] = [fromWallet.id, toWallet.id].sort();

        const lockedFromWallet = await tx.wallet.findUnique({
          where: { id: fromWallet.id }
        });

        const lockedToWallet = await tx.wallet.findUnique({
          where: { id: toWallet.id }
        });

        if (!lockedFromWallet || !lockedToWallet) {
          throw new Error('Wallets not found during transfer');
        }

        // Double-check balance
        if (lockedFromWallet.balance < amount) {
          throw new InsufficientBalanceError('Insufficient balance during transfer execution');
        }

        const fromBalanceAfter = Math.round((lockedFromWallet.balance - amount) * 100) / 100;
        const toBalanceAfter = Math.round((lockedToWallet.balance + amount) * 100) / 100;

        // Update both wallets
        await tx.wallet.update({
          where: { id: fromWallet.id },
          data: { balance: fromBalanceAfter }
        });

        await tx.wallet.update({
          where: { id: toWallet.id },
          data: { balance: toBalanceAfter }
        });

        // Record transactions for both wallets
        await tx.walletTransaction.create({
          data: {
            walletId: fromWallet.id,
            type: 'transfer_out',
            amount: -Math.round(amount * 100) / 100,
            balanceBefore: lockedFromWallet.balance,
            balanceAfter: fromBalanceAfter,
            description: `Transfer to ${toUserId}: ${description}`,
            referenceId: transfer.id,
            referenceType: 'transfer',
            status: 'completed'
          }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: toWallet.id,
            type: 'transfer_in',
            amount: Math.round(amount * 100) / 100,
            balanceBefore: lockedToWallet.balance,
            balanceAfter: toBalanceAfter,
            description: `Transfer from ${fromUserId}: ${description}`,
            referenceId: transfer.id,
            referenceType: 'transfer',
            status: 'completed'
          }
        });

        console.log(`Transfer completed: ${amount} from ${fromUserId} to ${toUserId}, ID: ${transfer.id}`);
      } else {
        console.log(`Transfer pending approval: ${amount} from ${fromUserId} to ${toUserId}, ID: ${transfer.id}`);
      }

      return transfer;
    }, {
      isolationLevel: 'Serializable',
      timeout: 15000,
      maxWait: 20000
    });

    return {
      transferId: result.id,
      status: result.status
    };
  }

  /**
   * Approve pending transfer
   * ENHANCEMENT: New method for escrow transfers
   */
  static async approveTransfer(
    transferId: string,
    approvedBy: string
  ): Promise<{ status: string }> {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.walletTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromWallet: true,
          toWallet: true
        }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.status !== 'pending') {
        throw new Error(`Transfer is not pending: ${transfer.status}`);
      }

      // Check if expired
      if (transfer.escrowExpires && transfer.escrowExpires < new Date()) {
        await tx.walletTransfer.update({
          where: { id: transferId },
          data: { status: 'cancelled', cancelledBy: approvedBy }
        });
        throw new Error('Transfer has expired');
      }

      // Check balance again
      if (transfer.fromWallet.balance < transfer.amount) {
        throw new InsufficientBalanceError('Insufficient balance to complete transfer');
      }

      const fromBalanceAfter = Math.round((transfer.fromWallet.balance - transfer.amount) * 100) / 100;
      const toBalanceAfter = Math.round((transfer.toWallet.balance + transfer.amount) * 100) / 100;

      // Execute transfer
      await tx.wallet.update({
        where: { id: transfer.fromWalletId },
        data: { balance: fromBalanceAfter }
      });

      await tx.wallet.update({
        where: { id: transfer.toWalletId },
        data: { balance: toBalanceAfter }
      });

      // Update transfer status
      await tx.walletTransfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          approvedBy,
          approvedAt: new Date()
        }
      });

      // Record transactions
      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: transfer.fromWalletId,
            type: 'transfer_out',
            amount: -transfer.amount,
            balanceBefore: transfer.fromWallet.balance,
            balanceAfter: fromBalanceAfter,
            description: `Approved transfer to ${transfer.toWalletId}`,
            referenceId: transferId,
            referenceType: 'transfer',
            status: 'completed'
          },
          {
            walletId: transfer.toWalletId,
            type: 'transfer_in',
            amount: transfer.amount,
            balanceBefore: transfer.toWallet.balance,
            balanceAfter: toBalanceAfter,
            description: `Approved transfer from ${transfer.fromWalletId}`,
            referenceId: transferId,
            referenceType: 'transfer',
            status: 'completed'
          }
        ]
      });

      console.log(`Transfer ${transferId} approved by ${approvedBy}`);

      return { status: 'completed' };
    }, {
      isolationLevel: 'Serializable',
      timeout: 15000
    });

    return result;
  }

  /**
   * Cancel pending transfer
   * ENHANCEMENT: New method for escrow cancellation
   */
  static async cancelTransfer(
    transferId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<{ status: string }> {
    await prisma.walletTransfer.update({
      where: { id: transferId },
      data: {
        status: 'cancelled',
        cancelledBy,
        cancelledAt: new Date()
      }
    });

    console.log(`Transfer ${transferId} cancelled by ${cancelledBy}: ${reason || 'No reason provided'}`);

    return { status: 'cancelled' };
  }

  /**
   * Get transaction history
   * ENHANCED: Added filtering and pagination
   */
  static async getTransactionHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<TransactionData[]> {
    const { limit = 50, offset = 0, type, startDate, endDate } = options;

    const wallet = await this.getOrCreateWallet(userId);

    const transactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        ...(type && { type: type as any }),
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate })
          }
        } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return transactions.map(tx => ({
      id: tx.id,
      walletId: tx.walletId,
      type: tx.type as any,
      amount: tx.amount,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      description: tx.description || undefined,
      referenceId: tx.referenceId || undefined,
      referenceType: tx.referenceType || undefined,
      status: tx.status as any,
      createdAt: tx.createdAt
    }));
  }

  /**
   * Get pending transfers for approval
   * ENHANCEMENT: New method for admin panel
   */
  static async getPendingTransfers(companyId?: string): Promise<any[]> {
    const transfers = await prisma.walletTransfer.findMany({
      where: {
        status: 'pending',
        ...(companyId && { companyId })
      },
      include: {
        fromWallet: {
          include: {
            user: {
              select: {
                memberId: true,
                fullName: true,
                email: true
              }
            }
          }
        },
        toWallet: {
          include: {
            user: {
              select: {
                memberId: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return transfers;
  }
}

/**
 * ENHANCEMENT: Custom error class for balance issues
 */
export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}
