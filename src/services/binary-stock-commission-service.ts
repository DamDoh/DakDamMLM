/**
 * Binary Stock Commission Service
 * 
 * Implements differential commission system with delayed payout logic:
 * - Higher-level stockholders earn differential commission ONLY AFTER lower-level completes a sale to a NEW registered user
 * - Lower-level gets paid before higher-level
 * - No reverse commission (lower → higher)
 * - No payment without validated downstream sale
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { StockistLevel, stockistLevelCommissions, stockistLevelHierarchy } from '@/lib/types';
import { WalletService } from './wallet-service';

export interface BinaryStockCommissionData {
  sellerId: string;
  buyerId: string;
  sellerLevel: StockistLevel;
  buyerLevel: StockistLevel | null;
  pvAmount: number;
  commissionRate: number;
  commissionAmount: number;
  transferId: string;
  companyId?: string;
}

/**
 * Calculate differential commission rate based on seller and buyer levels
 * Returns 0 if no commission should be earned (selling upward or to same level)
 */
export function calculateDifferentialCommissionRate(
  sellerLevel: StockistLevel,
  buyerLevel: StockistLevel | null
): number {
  // If buyer is a regular user (no stockist level), use base commission
  if (!buyerLevel) {
    return stockistLevelCommissions[sellerLevel];
  }

  // Check hierarchy: if buyer is same or higher level, NO COMMISSION
  const sellerHierarchy = stockistLevelHierarchy[sellerLevel];
  const buyerHierarchy = stockistLevelHierarchy[buyerLevel];
  
  if (buyerHierarchy >= sellerHierarchy) {
    // Same or higher level = NO COMMISSION
    return 0;
  }

  // Calculate differential commission
  const sellerBaseRate = stockistLevelCommissions[sellerLevel];
  const buyerBaseRate = stockistLevelCommissions[buyerLevel];
  
  // Differential = seller rate - buyer rate
  return sellerBaseRate - buyerBaseRate;
}

/**
 * Create a binary stock commission record
 * - If selling to regular user: Status = PAID (immediate payment)
 * - If selling to lower-level stockist: Status = PENDING (wait for buyer to sell first)
 */
export async function createBinaryStockCommission(
  data: BinaryStockCommissionData
): Promise<string> {
  const { sellerId, buyerId, sellerLevel, buyerLevel, pvAmount, commissionRate, commissionAmount, transferId, companyId } = data;

  // All commissions are paid immediately (auto-paid)
  // No pending status - all commissions are paid as soon as stock is transferred
  const status = 'Paid';

  // Get buyer info for description
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { fullName: true, memberId: true }
  }).catch(() => null);

  const buyerName = buyer?.fullName || buyer?.memberId || 'member';
  const buyerLevelText = buyerLevel ? ` (${buyerLevel})` : ' (Regular User)';
  
  const description = buyerLevel
    ? `Stock Transfer: ${pvAmount} PV to ${buyerName}${buyerLevelText} - Differential Commission (${sellerLevel}→${buyerLevel}: ${commissionRate}%)`
    : `Stock Transfer: ${pvAmount} PV to ${buyerName}${buyerLevelText} - Base Commission (${sellerLevel} level - ${commissionRate}%)`;

  // Create commission record
  const commission = await prisma.commission.create({
    data: {
      userId: sellerId,
      amount: commissionAmount,
      type: `Stockist Bonus (${sellerLevel})`,
      description,
      status,
      date: new Date(),
      companyId: companyId || undefined,
      // Binary Stock Commission fields
      sellerId,
      buyerId,
      sellerLevel,
      buyerLevel: buyerLevel || null,
      pvAmount,
      commissionRate,
      metadata: {
        transferId,
        isDifferential: !!buyerLevel,
        buyerName,
        ...(data as any).itemDetails ? { itemDetails: (data as any).itemDetails } : {}
      }
    }
  });

  logger.info(`Binary stock commission created`, {
    commissionId: commission.id,
    sellerId,
    buyerId,
    sellerLevel,
    buyerLevel: buyerLevel || 'Regular User',
    pvAmount,
    commissionRate: `${commissionRate}%`,
    commissionAmount: `$${commissionAmount.toFixed(2)}`,
    status,
    isDifferential: !!buyerLevel
  });

  // All commissions are paid immediately (auto-paid)
  await payCommission(commission.id, sellerId, commissionAmount, pvAmount, sellerLevel, commissionRate);

  return commission.id;
}

/**
 * Pay a commission (credit wallet and update status)
 */
async function payCommission(
  commissionId: string,
  userId: string,
  amount: number,
  pvAmount: number,
  stockistLevel: StockistLevel,
  commissionRate: number
): Promise<void> {
  try {
    // Add commission to E-Cash
    try {
      const { addCommissionToECash } = await import('./e-cash-service');
      await addCommissionToECash(
        userId,
        amount,
        commissionId,
        `Stockist Bonus (${stockistLevel})`
      );
    } catch (eCashError: any) {
      logger.warn('Failed to add commission to E-Cash (non-critical)', {
        error: eCashError.message,
        userId,
        commissionId
      });
    }

    // Credit commission to wallet
    await WalletService.creditWallet(
      userId,
      amount,
      `Stockist commission: ${pvAmount} PV transferred (${stockistLevel} level - ${commissionRate}%)`,
      commissionId,
      'commission'
    );

    // Update commission status to Paid
    await prisma.commission.update({
      where: { id: commissionId },
      data: { status: 'Paid' }
    });

    // Send notification
    try {
      await prisma.notification.create({
        data: {
          memberId: userId,
          type: 'in_app',
          category: 'commission',
          title: `Stockist Bonus Earned: $${amount.toFixed(2)}`,
          body: `You earned $${amount.toFixed(2)} in Stockist Bonus (${stockistLevel} level - ${commissionRate}%) for transferring ${pvAmount.toLocaleString()} PV.`,
          data: {
            commissionId,
            commissionType: `Stockist Bonus (${stockistLevel})`,
            amount,
            pvTransferred: pvAmount,
            stockistLevel,
            link: '/commission'
          },
          priority: 'high',
          isRead: false,
          isSent: false
        }
      });
    } catch (notifError: any) {
      logger.warn('Failed to create commission notification', {
        error: notifError.message,
        commissionId
      });
    }

    logger.info(`Commission paid successfully`, {
      commissionId,
      userId,
      amount: `$${amount.toFixed(2)}`
    });
  } catch (error) {
    logger.error('Failed to pay commission', {
      error: error instanceof Error ? error.message : 'Unknown error',
      commissionId,
      userId,
      amount
    });
    throw error;
  }
}

/**
 * Release pending commissions when a lower-level stockist sells/transfers stock to a NEW registered user
 * 
 * This function:
 * 1. Finds all PENDING commissions where the buyer (lower-level stockist) is the seller
 * 2. Validates that the sale/transfer is to a NEW registered user
 * 3. Releases commissions in order (lower-level first, then higher-level)
 * 
 * @param stockistId - The stockist who just sold/transferred stock to a new user
 * @param triggerId - The order ID or transfer ID that triggered this release
 * @param buyerId - The new registered user who purchased/received stock
 */
export async function releasePendingCommissions(
  stockistId: string,
  triggerId: string,
  buyerId: string
): Promise<void> {
  try {
    // Validate that the buyer is a NEW registered user
    // Check if this is their first fulfilled order OR first stock transfer received
    const buyerOrderCount = await prisma.order.count({
      where: {
        userId: buyerId,
        status: { in: ['Fulfilled', 'Completed', 'Delivered'] }
      }
    });

    // Also check if they've received stock transfers before
    const stockTransferCount = await (prisma as any).inventoryTransaction.count({
      where: {
        userId: buyerId,
        type: 'transfer'
      }
    }).catch(() => 0);

    const isNewUser = buyerOrderCount === 1 && stockTransferCount === 0;

    if (!isNewUser) {
      // Not a new user, don't release pending commissions
      logger.info(`Buyer ${buyerId} is not a new user (${buyerOrderCount} orders, ${stockTransferCount} transfers), skipping commission release`);
      return;
    }

    // Get the stockist's level
    const stockist = await prisma.user.findUnique({
      where: { id: stockistId },
      select: { storeOwnerLevel: true, fullName: true, memberId: true }
    });

    if (!stockist || !stockist.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(stockist.storeOwnerLevel)) {
      logger.warn(`Stockist ${stockistId} is not a valid stockist, skipping commission release`);
      return;
    }

    const stockistLevel = stockist.storeOwnerLevel as StockistLevel;

    // Find all PENDING commissions where this stockist is the buyer
    // These are commissions owed to higher-level stockists who sold to this stockist
    const pendingCommissions = await prisma.commission.findMany({
      where: {
        buyerId: stockistId,
        status: 'Pending',
        type: { startsWith: 'Stockist Bonus' },
        sellerLevel: { not: null } // Only differential commissions
      },
      orderBy: [
        // Order by seller level hierarchy (lower-level sellers first, then higher)
        // This ensures lower-level stockists get paid before higher-level
        { sellerLevel: 'asc' }
      ],
      include: {
        company: true
      }
    });

    if (pendingCommissions.length === 0) {
      logger.info(`No pending commissions found for stockist ${stockistId}`);
      return;
    }

    logger.info(`Releasing ${pendingCommissions.length} pending commissions for stockist ${stockistId}`, {
      stockistId,
      stockistLevel,
      triggerId,
      buyerId,
      pendingCount: pendingCommissions.length
    });

    // Release commissions in order (lower-level sellers first)
    for (const commission of pendingCommissions) {
      try {
        // Validate that seller is still a valid stockist
        const seller = await prisma.user.findUnique({
          where: { id: commission.sellerId! },
          select: { storeOwnerLevel: true, active: true }
        });

        if (!seller || !seller.active || !seller.storeOwnerLevel) {
          logger.warn(`Seller ${commission.sellerId} is not active or not a stockist, skipping commission ${commission.id}`);
          continue;
        }

        // Update commission with trigger sale ID
        await prisma.commission.update({
          where: { id: commission.id },
          data: {
            triggerSaleId: triggerId,
            description: `${commission.description} - RELEASED by sale/transfer to new user (Trigger: ${triggerId})`
          }
        });

        // Pay the commission
        await payCommission(
          commission.id,
          commission.userId,
          commission.amount,
          commission.pvAmount || 0,
          commission.sellerLevel as StockistLevel,
          commission.commissionRate || 0
        );

        logger.info(`Released pending commission`, {
          commissionId: commission.id,
          sellerId: commission.sellerId,
          sellerLevel: commission.sellerLevel,
          buyerId: commission.buyerId,
          buyerLevel: commission.buyerLevel,
          amount: `$${commission.amount.toFixed(2)}`,
          triggerSaleId: triggerId
        });
      } catch (error) {
        logger.error(`Failed to release commission ${commission.id}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          commissionId: commission.id,
          sellerId: commission.sellerId,
          buyerId: commission.buyerId
        });
        // Continue with next commission even if one fails
      }
    }

    logger.info(`Successfully released ${pendingCommissions.length} pending commissions`, {
      stockistId,
      triggerId
    });
  } catch (error) {
    logger.error('Failed to release pending commissions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stockistId,
      triggerId,
      buyerId,
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't throw - this is a background process that shouldn't break order creation
  }
}

/**
 * Check if a user is a NEW registered user (first order)
 */
export async function isNewRegisteredUser(userId: string): Promise<boolean> {
  const orderCount = await prisma.order.count({
    where: {
      userId,
      status: { in: ['Fulfilled', 'Completed', 'Delivered'] }
    }
  });

  return orderCount === 1;
}
