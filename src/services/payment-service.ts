'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { WalletServiceEnhanced } from '@/services/wallet-service-enhanced';

export interface PaymentMethod {
  id: string;
  type: 'wallet' | 'card' | 'bank_transfer' | 'crypto';
  name: string;
  isDefault: boolean;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface PaymentTransaction {
  id: string;
  orderId?: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  referenceId?: string;
  externalId?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
  userId: string;
}

/**
 * Process wallet payment
 */
export async function processWalletPayment(
  userId: string,
  amount: number,
  currency: string = 'USD',
  description?: string,
  orderId?: string,
  companyId?: string
): Promise<{ success: boolean; transactionId?: string; message?: string }> {
  try {
    // Check wallet balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { eCashBalance: true, fullName: true }
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if ((user.eCashBalance || 0) < amount) {
      return { success: false, message: 'Insufficient wallet balance' };
    }

    return await prisma.$transaction(async (tx) => {
      // Deduct from user's eCash balance
      await tx.user.update({
        where: { id: userId },
        data: {
          eCashBalance: {
            decrement: amount
          }
        }
      });

      // Update wallet balance
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: amount
          }
        }
      });

      // Create wallet transaction
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'debit',
          amount: -amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - amount,
          description: description || `Payment processed`,
          referenceId: orderId,
          referenceType: orderId ? 'order_payment' : 'payment',
          status: 'completed'
        }
      });

      // Create payment transaction record
      const paymentTransaction = await tx.paymentTransaction.create({
        data: {
          userId,
          orderId,
          amount,
          currency,
          method: 'wallet',
          status: 'completed',
          description,
          referenceId: walletTransaction.id,
          metadata: {
            walletTransactionId: walletTransaction.id,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance - amount
          },
          companyId
        }
      });

      // Log comprehensive transaction
      await tx.transactionLog.create({
        data: {
          userId,
          type: 'wallet_payment',
          amount,
          currency,
          description: description || `Wallet payment processed`,
          referenceId: paymentTransaction.id,
          referenceType: 'payment',
          status: 'completed',
          metadata: {
            method: 'wallet',
            orderId,
            walletTransactionId: walletTransaction.id
          },
          companyId
        }
      });

      logger.info('Wallet payment processed successfully', {
        userId,
        amount,
        currency,
        paymentTransactionId: paymentTransaction.id,
        walletTransactionId: walletTransaction.id
      });

      return { success: true, transactionId: paymentTransaction.id };
    });
  } catch (error) {
    logger.error('Failed to process wallet payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      amount,
      currency
    });
    return { success: false, message: 'Failed to process payment' };
  }
}

/**
 * Process card payment (Stripe integration)
 */
export async function processCardPayment(
  userId: string,
  amount: number,
  currency: string = 'USD',
  paymentMethodId: string,
  description?: string,
  orderId?: string,
  companyId?: string
): Promise<{ success: boolean; transactionId?: string; requiresAction?: boolean; clientSecret?: string; message?: string }> {
  try {
    // This would integrate with Stripe or other payment processor
    // For now, we'll simulate the process

    return await prisma.$transaction(async (tx) => {
      // Create payment intent record
      const paymentIntent = await tx.paymentIntent.create({
        data: {
          userId,
          orderId,
          amount,
          currency,
          status: 'processing',
          paymentMethodId,
          description,
          metadata: {
            paymentMethodType: 'card'
          },
          companyId
        }
      });

      // Simulate payment processing
      // In real implementation, this would call Stripe API
      const success = Math.random() > 0.1; // 90% success rate for simulation

      if (success) {
        // Update payment intent
        await tx.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: { status: 'succeeded' }
        });

        // Create payment transaction record
        const paymentTransaction = await tx.paymentTransaction.create({
          data: {
            userId,
            orderId,
            amount,
            currency,
            method: 'card',
            status: 'completed',
            description,
            externalId: `stripe_${paymentIntent.id}`,
            referenceId: paymentIntent.id,
            metadata: {
              paymentMethodId,
              paymentIntentId: paymentIntent.id
            },
            companyId
          }
        });

        // Log transaction
        await tx.transactionLog.create({
          data: {
            userId,
            type: 'card_payment',
            amount,
            currency,
            description: description || `Card payment processed`,
            referenceId: paymentTransaction.id,
            referenceType: 'payment',
            status: 'completed',
            metadata: {
              method: 'card',
              orderId,
              paymentIntentId: paymentIntent.id
            },
            companyId
          }
        });

        return { success: true, transactionId: paymentTransaction.id };
      } else {
        // Payment failed
        await tx.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: { status: 'failed' }
        });

        return { success: false, message: 'Payment failed' };
      }
    });
  } catch (error) {
    logger.error('Failed to process card payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      amount,
      currency
    });
    return { success: false, message: 'Failed to process payment' };
  }
}

/**
 * Process bank transfer payment
 */
export async function processBankTransferPayment(
  userId: string,
  amount: number,
  currency: string = 'USD',
  description?: string,
  orderId?: string,
  companyId?: string
): Promise<{ success: boolean; transactionId?: string; instructions?: string; message?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Create payment transaction record with pending status
      const paymentTransaction = await tx.paymentTransaction.create({
        data: {
          userId,
          orderId,
          amount,
          currency,
          method: 'bank_transfer',
          status: 'pending',
          description,
          metadata: {
            instructions: 'Please transfer funds to the following account and upload proof of payment.'
          },
          companyId
        }
      });

      // Log transaction
      await tx.transactionLog.create({
        data: {
          userId,
          type: 'bank_transfer_initiated',
          amount,
          currency,
          description: description || `Bank transfer initiated`,
          referenceId: paymentTransaction.id,
          referenceType: 'payment',
          status: 'pending',
          metadata: {
            method: 'bank_transfer',
            orderId
          },
          companyId
        }
      });

      const instructions = `
Bank Transfer Instructions:
Account Name: DakDam MLM Company
Account Number: 1234567890
Bank: Sample Bank
Routing Number: 123456789
Reference: ${paymentTransaction.id}

Please upload proof of payment after transfer.
      `;

      return {
        success: true,
        transactionId: paymentTransaction.id,
        instructions
      };
    });
  } catch (error) {
    logger.error('Failed to process bank transfer payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      amount,
      currency
    });
    return { success: false, message: 'Failed to initiate bank transfer' };
  }
}

/**
 * Process refund
 */
export async function processRefund(
  request: RefundRequest
): Promise<{ success: boolean; refundId?: string; message?: string }> {
  try {
    const { transactionId, amount, reason, userId } = request;

    // Get original transaction
    const originalTransaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { order: true }
    });

    if (!originalTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    if (originalTransaction.userId !== userId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (!['completed', 'processing'].includes(originalTransaction.status)) {
      return { success: false, message: 'Transaction cannot be refunded' };
    }

    if (amount > originalTransaction.amount) {
      return { success: false, message: 'Refund amount cannot exceed original transaction amount' };
    }

    return await prisma.$transaction(async (tx) => {
      // Create refund transaction
      const refundTransaction = await tx.paymentTransaction.create({
        data: {
          userId,
          orderId: originalTransaction.orderId,
          amount: -amount, // Negative amount for refund
          currency: originalTransaction.currency,
          method: originalTransaction.method,
          status: 'completed',
          description: `Refund: ${reason}`,
          referenceId: transactionId,
          metadata: {
            originalTransactionId: transactionId,
            refundReason: reason,
            refundAmount: amount
          },
          companyId: originalTransaction.companyId
        }
      });

      // If wallet payment, refund to wallet
      if (originalTransaction.method === 'wallet') {
        await tx.user.update({
          where: { id: userId },
          data: {
            eCashBalance: {
              increment: amount
            }
          }
        });

        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { id: true, balance: true }
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: {
                increment: amount
              }
            }
          });

          // Create wallet transaction for refund
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount,
              balanceBefore: wallet.balance,
              balanceAfter: wallet.balance + amount,
              description: `Refund for transaction ${transactionId}: ${reason}`,
              referenceId: refundTransaction.id,
              referenceType: 'refund',
              status: 'completed'
            }
          });
        }
      }

      // Update original transaction status
      await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: amount === originalTransaction.amount ? 'refunded' : 'partially_refunded',
          metadata: {
            ...originalTransaction.metadata,
            refundId: refundTransaction.id,
            refundAmount: amount,
            refundReason: reason
          }
        }
      });

      // Log refund transaction
      await tx.transactionLog.create({
        data: {
          userId,
          type: 'refund_processed',
          amount,
          currency: originalTransaction.currency,
          description: `Refund processed: ${reason}`,
          referenceId: refundTransaction.id,
          referenceType: 'refund',
          status: 'completed',
          metadata: {
            originalTransactionId: transactionId,
            refundReason: reason
          },
          companyId: originalTransaction.companyId
        }
      });

      return { success: true, refundId: refundTransaction.id };
    });
  } catch (error) {
    logger.error('Failed to process refund', {
      error: error instanceof Error ? error.message : 'Unknown error',
      transactionId: request.transactionId,
      userId: request.userId
    });
    return { success: false, message: 'Failed to process refund' };
  }
}

/**
 * Get payment methods for user
 */
export async function getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: { isDefault: 'desc' }
    });

    return methods.map(method => ({
      id: method.id,
      type: method.type as any,
      name: method.name,
      isDefault: method.isDefault,
      isActive: method.isActive,
      metadata: method.metadata as Record<string, any>
    }));
  } catch (error) {
    logger.error('Failed to get user payment methods', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return [];
  }
}

/**
 * Add payment method
 */
export async function addPaymentMethod(
  userId: string,
  type: 'card' | 'bank_transfer' | 'crypto',
  name: string,
  metadata?: Record<string, any>,
  setAsDefault: boolean = false
): Promise<{ success: boolean; methodId?: string; message?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (setAsDefault) {
        // Remove default from other methods
        await tx.paymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false }
        });
      }

      const method = await tx.paymentMethod.create({
        data: {
          userId,
          type,
          name,
          isDefault: setAsDefault,
          metadata
        }
      });

      return { success: true, methodId: method.id };
    });
  } catch (error) {
    logger.error('Failed to add payment method', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      type
    });
    return { success: false, message: 'Failed to add payment method' };
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  userId: string,
  type?: string,
  status?: string,
  limit: number = 50,
  companyId?: string
): Promise<PaymentTransaction[]> {
  try {
    const where: any = { userId };
    if (type) where.method = type;
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return transactions.map(tx => ({
      id: tx.id,
      orderId: tx.orderId || undefined,
      userId: tx.userId,
      amount: tx.amount,
      currency: tx.currency,
      method: tx.method,
      status: tx.status as any,
      referenceId: tx.referenceId || undefined,
      externalId: tx.externalId || undefined,
      description: tx.description || undefined,
      metadata: tx.metadata as Record<string, any>,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt
    }));
  } catch (error) {
    logger.error('Failed to get transaction history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return [];
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\payment-service.ts