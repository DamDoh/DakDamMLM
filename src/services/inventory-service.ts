/**
 * INVENTORY MANAGEMENT SERVICE
 *
 * Handles all inventory operations including:
 * - Stock level tracking
 * - Transaction recording
 * - Stock transfers
 * - Low stock alerts
 *
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { WalletServiceEnhanced } from '@/services/wallet-service-enhanced';
import { canTransferStock, type StockistLevel, stockistLevelHierarchy } from '@/lib/types';

export interface InventoryTransaction {
  id: string;
  productId: string;
  userId?: string;
  type: 'purchase' | 'sale' | 'transfer' | 'adjustment' | 'return';
  quantity: number;
  previousQty: number;
  newQty: number;
  reference?: string;
  reason?: string;
  companyId?: string;
  createdAt: Date;
  createdBy: string;
}

export interface StockTransferItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Update stock levels for a product
 */
export async function updateStockLevels(
  productId: string,
  quantity: number,
  operation: 'add' | 'subtract',
  reference?: string,
  userId?: string,
  reason?: string,
  companyId?: string
): Promise<{ success: boolean; newQuantity: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get current product
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const previousQty = product.qty;
      const adjustment = operation === 'add' ? quantity : -quantity;
      const newQty = Math.max(0, previousQty + adjustment);

      // Update product quantity
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQty }
      });

      // Record transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: operation === 'add' ? 'purchase' : 'sale',
          quantity: Math.abs(adjustment),
          previousQty,
          newQty,
          reference,
          reason,
          companyId,
          createdBy: userId || 'system'
        }
      });

      logger.info(`Stock levels updated`, {
        productId,
        product: product.name,
        operation,
        quantity,
        previousQty,
        newQty
      });

      return { success: true, newQuantity: newQty };
    });
  } catch (error) {
    logger.error('Failed to update stock levels', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      quantity,
      operation
    });
    throw error;
  }
}

/**
 * Get current stock level for a product
 */
export async function getStockLevel(productId: string, companyId?: string): Promise<number> {
  try {
    const where: any = { id: productId };
    if (companyId) {
      where.companyId = companyId;
    }

    const product = await prisma.product.findUnique({
      where,
      select: { qty: true }
    });

    return product?.qty || 0;
  } catch (error) {
    logger.error('Failed to get stock level', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId
    });
    return 0;
  }
}

/**
 * Reserve stock for an order (prevents overselling)
 */
export async function reserveStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Check availability only - don't deduct yet
      // Stock will be deducted when order is fulfilled (approved by admin)
      if (product.qty < quantity) {
        logger.warn(`Insufficient stock for reservation`, {
          productId,
          available: product.qty,
          requested: quantity
        });
        return false;
      }

      // NOTE: We don't deduct stock here anymore
      // Stock is deducted when order is fulfilled (approved by admin)
      // This prevents double deduction and ensures stock is only deducted upon approval

      logger.info(`Stock reserved`, {
        productId,
        product: product.name,
        quantity,
        orderId
      });

      return true;
    });
  } catch (error) {
    logger.error('Failed to reserve stock', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      quantity,
      orderId
    });
    return false;
  }
}

/**
 * Release reserved stock (e.g., when order is cancelled)
 */
export async function releaseStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Add quantity back
      const newQty = product.qty + quantity;
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQty }
      });

      // Record release transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: 'return',
          quantity,
          previousQty: product.qty,
          newQty,
          reference: orderId,
          reason: 'Stock released from cancelled order',
          companyId,
          createdBy: userId
        }
      });

      logger.info(`Stock released`, {
        productId,
        product: product.name,
        quantity,
        orderId
      });

      return true;
    });
  } catch (error) {
    logger.error('Failed to release stock', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      quantity,
      orderId
    });
    return false;
  }
}

/**
 * Transfer stock between users (for stockist system)
 * This function handles user-to-user stock transfers by creating inventory transactions
 */
export async function transferStock(
  fromUserId: string,
  toUserId: string,
  items: StockTransferItem[],
  companyId?: string,
  commissionMode: 'base' | 'differential' = 'differential',
  pvDestination: 'rank' | 'product' = 'rank' // Where the PV should go for recipient
): Promise<{ success: boolean; transferId?: string; message?: string }> {
  try {
    // Skip validation for system transfers (admin inventory management)
    if (fromUserId !== 'system' && fromUserId !== toUserId) {
      // Check stockist level restrictions: higher level can transfer to lower level
      const sender = await prisma.user.findUnique({
        where: { id: fromUserId },
        select: {
          id: true,
          storeOwnerLevel: true,
          isAdmin: true,
          fullName: true
        }
      });

      const recipient = await prisma.user.findUnique({
        where: { id: toUserId },
        select: {
          id: true,
          storeOwnerLevel: true,
          fullName: true
        }
      });

      if (!sender || !recipient) {
        return {
          success: false,
          message: 'Sender or recipient not found'
        };
      }

      // Admins can always transfer (skip level check)
      if (!sender.isAdmin && sender.storeOwnerLevel) {
        // Check if sender can transfer to recipient based on stockist levels
        const senderLevel = sender.storeOwnerLevel as StockistLevel | null;
        const recipientLevel = recipient.storeOwnerLevel as StockistLevel | null;

        if (!canTransferStock(senderLevel, recipientLevel)) {
          const senderLevelName = senderLevel ? `(${senderLevel})` : '';
          const recipientLevelName = recipientLevel ? `(${recipientLevel})` : '';
          
          return {
            success: false,
            message: `Cannot transfer stock. Stockist level ${senderLevelName} cannot transfer to stockist level ${recipientLevelName}. Only higher level stockists can transfer to lower level stockists.`
          };
        }
      }
    }

    const transferId = `TRANSFER-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      // Check if InventoryTransaction model is available
      if (!(tx as any).inventoryTransaction) {
        throw new Error('InventoryTransaction model not available');
      }

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, qty: true }
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        // Handle system/warehouse transfers (admin transfers from main inventory)
        if (fromUserId === 'system') {
          // Check product's qty field for system transfers
          const availableStock = Number(product.qty) || 0;
          
          if (availableStock < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`);
          }

          // Deduct from product's qty when transferring from system
          await tx.product.update({
            where: { id: item.productId },
            data: {
              qty: {
                decrement: item.quantity
              }
            }
          });
        } else {
          // Handle user-to-user transfers by checking inventory transactions
          const sellerTransactions = await (tx as any).inventoryTransaction.findMany({
            where: { 
              userId: fromUserId,
              productId: item.productId
            },
            orderBy: { createdAt: 'asc' }
          });

          // Calculate seller's current stock
          let sellerStock = 0;
          for (const transaction of sellerTransactions) {
            const qty = Number(transaction.quantity) || 0;
            if (transaction.type === 'purchase' || transaction.type === 'transfer' || transaction.type === 'return') {
              sellerStock += qty;
            } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
              sellerStock -= qty;
            }
          }
          sellerStock = Math.max(0, sellerStock);

          // Check if seller has enough stock
          if (sellerStock < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${sellerStock}, Requested: ${item.quantity}`);
          }

          // Create transaction to DEDUCT from seller's inventory (type: 'sale')
          await (tx as any).inventoryTransaction.create({
            data: {
              productId: item.productId,
              userId: fromUserId,
              type: 'sale',
              quantity: item.quantity,
              previousQty: sellerStock,
              newQty: sellerStock - item.quantity,
              reference: transferId,
              reason: `Stock sold to downline (${toUserId})`,
              companyId,
              createdBy: fromUserId,
              createdAt: new Date()
            }
          });
        }

        // Get buyer's current inventory to calculate their new quantity
        const buyerTransactions = await (tx as any).inventoryTransaction.findMany({
          where: { 
            userId: toUserId,
            productId: item.productId
          },
          orderBy: { createdAt: 'asc' }
        });

        let buyerStock = 0;
        for (const transaction of buyerTransactions) {
          const qty = Number(transaction.quantity) || 0;
          if (transaction.type === 'purchase' || transaction.type === 'transfer' || transaction.type === 'return') {
            buyerStock += qty;
          } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
            buyerStock -= qty;
          }
        }
        buyerStock = Math.max(0, buyerStock);

        // Create transaction to ADD to buyer's inventory (type: 'transfer')
        await (tx as any).inventoryTransaction.create({
          data: {
            productId: item.productId,
            userId: toUserId,
            type: 'transfer',
            quantity: item.quantity,
            previousQty: buyerStock,
            newQty: buyerStock + item.quantity,
            reference: transferId,
            reason: fromUserId === 'system' 
              ? `Admin transfer from main inventory` 
              : `Stock purchased from ${fromUserId}`,
            companyId,
            createdBy: fromUserId === 'system' ? 'admin' : fromUserId,
            createdAt: new Date()
          }
        });
      }

      logger.info(`Stock transferred`, {
        transferId,
        fromUserId,
        toUserId,
        itemCount: items.length
      });

      // Create StockRequest record for transfer history (invoice/transaction record)
      // This makes the transfer visible in "Stock Transfer Requests" section
      if (fromUserId !== 'system') {
        try {
          // Get sender and recipient details
          const sender = await tx.user.findUnique({
            where: { id: fromUserId },
            select: { fullName: true, memberId: true, storeOwnerLevel: true }
          });

          const recipient = await tx.user.findUnique({
            where: { id: toUserId },
            select: { fullName: true, memberId: true, storeOwnerLevel: true }
          });

          if (sender && recipient) {
            // Calculate total value and total PV
            let totalValue = 0;
            let totalPV = 0;

            for (const item of items) {
              const price = item.unitPrice || 0;
              totalValue += price * item.quantity;

              // Get PV from product
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { pv: true }
              });
              const itemPV = (product?.pv || 0) * item.quantity;
              totalPV += itemPV;
            }

            // Create StockRequestItem records (shared for both sender and recipient records)
            const stockRequestItems = [];
            for (const item of items) {
              // Get product PV
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { pv: true }
              });

              stockRequestItems.push({
                productId: item.productId,
                productName: item.productName,
                requestedQuantity: item.quantity,
                unitPrice: item.unitPrice || 0,
                pv: product?.pv || 0
              });
            }

            // Create StockRequest record for SENDER (so they see it in their history)
            // NOTE: We only create ONE record (sender's record) to avoid duplicates
            // The recipient will see this transfer via the query filter: { toUserId: recipient.id, stockistId: { not: recipient.id } }
            // But wait, that won't work because the stockistId is the sender's id, not the recipient's
            // So we need to create both records, but the API will deduplicate them
            const senderStockRequest = await tx.stockRequest.create({
              data: {
                stockistId: fromUserId, // Sender sees this record
                stockistName: sender.fullName,
                stockistLevel: sender.storeOwnerLevel || '',
                requesterId: toUserId, // The recipient (buyer)
                fromUserId: fromUserId, // Sender ID for transfer history
                toUserId: toUserId, // Recipient ID for transfer history
                status: 'Approved', // Already completed transfer
                itemCount: items.length,
                totalValue,
                totalPV,
                approvedBy: fromUserId,
                approvedDate: new Date(),
                createdDate: new Date(),
                notes: commissionMode === 'differential' 
                  ? 'Binary Stock Transfer (Differential Commission)'
                  : 'My Stock Transfer (Base Commission)',
                items: {
                  create: stockRequestItems
                }
              } as any // Type assertion needed until Prisma types are fully regenerated
            });

            // Create StockRequest record for RECIPIENT (so they see it in their history)
            // This record will be deduplicated in the API query to show only one per transfer
            const recipientStockRequest = await tx.stockRequest.create({
              data: {
                stockistId: toUserId, // Recipient sees this record
                stockistName: recipient.fullName,
                stockistLevel: recipient.storeOwnerLevel || sender.storeOwnerLevel || '',
                requesterId: fromUserId, // The sender
                fromUserId: fromUserId, // Sender ID for transfer history
                toUserId: toUserId, // Recipient ID for transfer history
                status: 'Approved', // Already completed transfer
                itemCount: items.length,
                totalValue,
                totalPV,
                approvedBy: fromUserId,
                approvedDate: new Date(),
                createdDate: new Date(),
                notes: commissionMode === 'differential' 
                  ? 'Binary Stock Transfer (Differential Commission) - Received'
                  : 'My Stock Transfer (Base Commission) - Received',
                items: {
                  create: stockRequestItems
                }
              } as any // Type assertion needed until Prisma types are fully regenerated
            });

            logger.info(`StockRequest records created for transfer history (sender and recipient)`, {
              transferId,
              fromUserId,
              toUserId,
              senderStockRequestId: senderStockRequest.id,
              recipientStockRequestId: recipientStockRequest.id,
              status: 'Approved'
            });
          }
        } catch (stockRequestError: any) {
          // Log but don't fail the transfer if StockRequest creation fails
          logger.error(`Failed to create StockRequest record for transfer history`, {
            transferId,
            fromUserId,
            toUserId,
            error: stockRequestError.message,
            stack: stockRequestError.stack,
            errorCode: (stockRequestError as any)?.code
          });
          
          // Log the full error details for debugging
          console.error('❌ StockRequest creation failed:', {
            transferId,
            fromUserId,
            toUserId,
            error: stockRequestError.message,
            stack: stockRequestError.stack
          });
        }
      }
    });

    // Update recipient's PV/Rank after successful stock transfer (Top-Up to Member mode)
    // When AdminStock top-ups stock to a REGULAR MEMBER (not another AdminStock) with pvDestination === 'rank',
    // the member's PV should increase and rank should upgrade automatically
    // IMPORTANT: Stockist-to-stockist transfers should NEVER update PV/Rank, only PV/Stock
    if (fromUserId !== 'system' && fromUserId !== toUserId && pvDestination === 'rank') {
      try {
        // Check if sender is AdminStock and recipient is NOT AdminStock (regular member)
        const sender = await prisma.user.findUnique({
          where: { id: fromUserId },
          select: { storeOwnerLevel: true }
        });
        
        const recipient = await prisma.user.findUnique({
          where: { id: toUserId },
          select: { storeOwnerLevel: true }
        });

        const isAdminStockToMember = sender?.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(sender.storeOwnerLevel) &&
          (!recipient?.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(recipient.storeOwnerLevel));

        // Only update PV/Rank if it's AdminStock → regular member transfer
        // Stockist-to-stockist transfers should NOT update PV/Rank
        if (!isAdminStockToMember) {
          logger.info(`Skipping PV/Rank update - stockist-to-stockist transfer (should only update PV/Stock)`, {
            transferId,
            fromUserId,
            toUserId,
            senderLevel: sender?.storeOwnerLevel,
            recipientLevel: recipient?.storeOwnerLevel
          });
        } else {
          // Calculate total PV value of transferred stock
          let totalPVValue = 0;
          
          for (const item of items) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { pv: true }
            });
            
            if (product) {
              const itemPV = (product.pv || 0) * item.quantity;
              totalPVValue += itemPV;
            }
          }

          // Only update PV if there's PV value
          if (totalPVValue > 0) {
            // Get recipient's current PV and rank
            const recipient = await prisma.user.findUnique({
              where: { id: toUserId },
              select: {
                id: true,
                pv: true,
                rank: true,
                memberId: true,
                fullName: true
              }
            });

            if (recipient) {
            const currentPV = recipient.pv || 0;
            const newPV = currentPV + totalPVValue;

            // Update recipient's PV (rankOnlyNoPv = false so E-comm shows PV/Rank)
            await prisma.user.update({
              where: { id: toUserId },
              data: { pv: newPV, rankOnlyNoPv: false }
            });

            logger.info(`Recipient PV updated after stock transfer`, {
              transferId,
              toUserId: recipient.memberId,
              currentPV,
              addedPV: totalPVValue,
              newPV
            });

            // CRITICAL: Update rank BEFORE handlePVChange
            // checkAndTriggerDailyMatch requires sponsor's G1 children to have rank !== 'Member' (Bronze+)
            // If we call handlePVChange before rank update, the member may still be "Member" and get excluded,
            // causing Daily Match and Matching Bonus to NOT trigger (AdminStock top-up bug)
            const { shouldUpdateRank } = await import('@/lib/rank');
            const rankUpdateResult = shouldUpdateRank(recipient.rank as any, newPV);
            let oldRank = recipient.rank;
            let newRank = recipient.rank;

            if (rankUpdateResult.shouldUpdate && rankUpdateResult.newRank !== recipient.rank) {
              oldRank = recipient.rank;
              newRank = rankUpdateResult.newRank;
              
              // Update recipient's rank BEFORE handlePVChange
              await prisma.user.update({
                where: { id: toUserId },
                data: { rank: newRank, rankOnlyNoPv: false }
              });

              logger.info(`Recipient rank upgraded after stock transfer`, {
                transferId,
                toUserId: recipient.memberId,
                recipientName: recipient.fullName,
                oldRank,
                newRank,
                newPV,
                reason: rankUpdateResult.reason
              });
            }

            // CRITICAL: Add PV to sponsor's waiting PV and trigger Daily Match + Matching Bonus
            // MUST run AFTER rank update so checkAndTriggerDailyMatch sees the member as Bronze+ (not "Member")
            try {
              const { PVMatchingService } = await import('./pv-matching-service');
              await PVMatchingService.handlePVChange(toUserId, currentPV, newPV);
              logger.info(`PV added to sponsor's waiting PV for binary bonus`, {
                memberId: recipient.memberId,
                oldPV: currentPV,
                newPV,
                pvDifference: totalPVValue
              });
            } catch (pvMatchingError: any) {
              // Log but don't fail the transfer if PV matching update fails
              logger.error('Failed to update sponsor waiting PV for binary bonus', {
                error: pvMatchingError.message,
                transferId,
                toUserId: recipient.memberId,
                pvDifference: totalPVValue
              });
            }

            // CRITICAL: Create Binary Bonus for sponsor when member receives PV (rank upgrade OR PV add)
            // Use sponsorId (referral sponsor) - matches UI "Sponsor" and calculateBinaryBonusOnRankChange
            try {
                const recipientWithSponsor = await prisma.user.findUnique({
                  where: { id: toUserId },
                  select: { sponsorId: true, placementParentId: true, position: true }
                });

                // Use sponsorId (referral sponsor) - "Sponsor" in UI; fallback to placementParentId if no sponsorId
                const sponsorId = recipientWithSponsor?.sponsorId || recipientWithSponsor?.placementParentId;
                if (sponsorId) {
                  const { getCommissionRateByRank } = await import('@/lib/referral-tracking');
                  
                  // Get sponsor's rank
                  const sponsorUser = await prisma.user.findUnique({
                    where: { id: sponsorId },
                    select: { rank: true, companyId: true, memberId: true, fullName: true }
                  });

                  const sponsorRank = sponsorUser?.rank || null;
                  const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
                  
                  // Pay Binary Bonus when PV is added and both member and sponsor have Bronze+
                  // Works for direct (A, B) and indirect downlines (C, D...)
                  const memberCurrentRank = newRank || recipient.rank;
                  const isMemberRankEligible = memberCurrentRank && validRanks.includes((memberCurrentRank as string).trim());
                  const isSponsorValidRank = sponsorRank && validRanks.includes(sponsorRank.trim());
                  
                  if (isMemberRankEligible && isSponsorValidRank && totalPVValue > 0) {
                    const pvIncrement = newPV - currentPV;
                    const commissionRate = getCommissionRateByRank(sponsorRank.trim());
                    
                    if (pvIncrement > 0 && commissionRate > 0) {
                      const commissionAmount = Math.round((pvIncrement * commissionRate) * 100) / 100;
                      
                      // Check if Binary Bonus already exists for this PV addition (prevent duplicates)
                      const recentCommissions = await prisma.commission.findMany({
                        where: {
                          userId: sponsorId,
                          type: 'Binary Bonus',
                          description: { contains: recipient.memberId || recipient.id },
                          date: { gte: new Date(Date.now() - 5 * 60 * 1000) }
                        }
                      });

                      const rankUpgraded = oldRank !== newRank;
                      const duplicateExists = recentCommissions.some(comm => {
                        const desc = comm.description || '';
                        if (rankUpgraded) {
                          return desc.includes(`${oldRank} upgraded to ${newRank}`) || desc.includes(`upgraded to ${newRank}`);
                        }
                        return desc.includes(`+${pvIncrement} PV`) && desc.includes('via top-up');
                      });

                      if (!duplicateExists) {
                        const rankUpgradeText = rankUpgraded ? ` upgraded to ${(newRank as string).trim()}` : '';
                        const commission = await prisma.commission.create({
                          data: {
                            userId: sponsorId,
                            amount: commissionAmount,
                            type: 'Binary Bonus',
                            status: 'Paid',
                            date: new Date(),
                            description: `Binary Bonus: ${recipient.fullName || recipient.memberId} (${(memberCurrentRank as string).trim()}, +${pvIncrement} PV)${rankUpgradeText} via top-up - ${pvIncrement} PV × ${(commissionRate * 100).toFixed(1)}%`,
                            companyId: sponsorUser?.companyId || null
                          }
                        });

                        // Credit wallet
                        try {
                          let wallet = await prisma.wallet.findUnique({
                            where: { userId: sponsorId }
                          });

                          if (!wallet) {
                            wallet = await prisma.wallet.create({
                              data: {
                                userId: sponsorId,
                                balance: 0
                              }
                            });
                          }

                          await prisma.wallet.update({
                            where: { id: wallet.id },
                            data: {
                              balance: {
                                increment: commissionAmount
                              }
                            }
                          });

                          // CRITICAL: Update user's eCashBalance field (used by E-Cash page)
                          try {
                            await prisma.user.update({
                              where: { id: sponsorId },
                              data: {
                                eCashBalance: {
                                  increment: commissionAmount
                                } as any
                              }
                            });
                            logger.info('User eCashBalance updated for Binary Bonus', {
                              sponsorId,
                              commissionAmount
                            });
                          } catch (eCashError: any) {
                            // Log but don't fail if eCashBalance field doesn't exist
                            logger.debug('Could not update eCashBalance field (may not exist)', {
                              error: eCashError.message,
                              sponsorId
                            });
                          }

                          logger.info('Binary Bonus commission paid for AdminStock transfer/top-up', {
                            commissionId: commission.id,
                            sponsorId: sponsorId,
                            sponsorMemberId: sponsorUser?.memberId,
                            memberId: recipient.memberId,
                            oldRank,
                            newRank,
                            oldPV: currentPV,
                            newPV,
                            pvIncrement,
                            commissionRate,
                            commissionAmount
                          });
                        } catch (walletError: any) {
                          logger.error('Failed to credit wallet for Binary Bonus (rank upgrade)', {
                            error: walletError.message,
                            sponsorId: sponsorId,
                            commissionAmount
                          });
                        }
                        } else {
                          logger.info('Binary Bonus already exists for this PV addition, skipping duplicate', {
                            sponsorId,
                            memberId: recipient.memberId,
                            pvIncrement
                          });
                        }
                    }
                  }
                }
              } catch (binaryBonusError: any) {
                logger.error('Failed to create Binary Bonus for AdminStock transfer/top-up', {
                  error: binaryBonusError.message,
                  memberId: recipient.memberId,
                  oldRank,
                  newRank
                });
              }

              // G2 Binary Bonus for grandparent when G2 member receives PV (works for renew top-ups)
              try {
                const { payG2BinaryBonusForPVTopUp } = await import('@/services/g2-binary-bonus-auto-calc');
                await payG2BinaryBonusForPVTopUp(toUserId, totalPVValue);
                logger.info('G2 Binary Bonus paid for PV top-up', { toUserId, pvIncrement: totalPVValue });
              } catch (g2Error: any) {
                logger.warn('Failed to pay G2 Binary Bonus for PV top-up', { error: g2Error?.message, toUserId });
              }

              // Optionally send notification about rank upgrade
              try {
                const { createNotification } = await import('@/services/notification-service');
                await createNotification(
                  toUserId,
                  'rank-upgraded',
                  {
                    oldRank,
                    newRank,
                    pv: String(newPV)
                  },
                  'high',
                  {
                    type: 'rank_upgrade',
                    link: '/profile'
                  }
                );
              } catch (notifError) {
                // Log but don't fail if notification fails
                logger.warn('Failed to send rank upgrade notification', {
                  error: notifError instanceof Error ? notifError.message : 'Unknown error',
                  toUserId: recipient.memberId
                });
              }
            }
          }
        }
      } catch (pvUpdateError: any) {
        // Log but don't fail the transfer if PV/rank update fails
        logger.error('Failed to update recipient PV and rank after stock transfer', {
          error: pvUpdateError.message,
          transferId,
          toUserId
        });
      }
    }

    // Create wallet transactions for stock transfers (user-to-user transfers only)
    // Note: For pvDestination === 'rank' (Top-Up to Member), PV has already been updated above in user.pv.
    // For pvDestination === 'product' (Transfer to Member), PV goes to PV/Product via wallet transactions.
    // For stockist-to-stockist transfers, wallet transactions always use 'stock_transfer' (PV/Stock).
    if (fromUserId !== 'system' && fromUserId !== toUserId) {
      try {
        // Check if sender is AdminStock and recipient is NOT AdminStock (regular member)
        const sender = await prisma.user.findUnique({
          where: { id: fromUserId },
          select: { storeOwnerLevel: true }
        });
        
        const recipient = await prisma.user.findUnique({
          where: { id: toUserId },
          select: { storeOwnerLevel: true }
        });

        const isAdminStockToMember = sender?.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(sender.storeOwnerLevel) &&
          (!recipient?.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(recipient.storeOwnerLevel));

        // For AdminStock → regular member transfers
        if (isAdminStockToMember) {
          // Calculate total PV value and product names for transaction records
          let totalPVValue = 0;
          const productNames: string[] = [];
          
          for (const item of items) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { pv: true, name: true }
            });
            
            if (product) {
              const itemPV = (product.pv || 0) * item.quantity;
              totalPVValue += itemPV;
              productNames.push(`${item.quantity}x ${product.name}`);
            }
          }

          if (totalPVValue > 0) {
            // Get sender details for transaction description
            const senderDetails = await prisma.user.findUnique({
              where: { id: fromUserId },
              select: { fullName: true, memberId: true, storeOwnerLevel: true }
            });

            try {
              // Get or create wallet for member
              let memberWallet = await prisma.wallet.findUnique({
                where: { userId: toUserId }
              });

              if (!memberWallet) {
                memberWallet = await prisma.wallet.create({
                  data: {
                    userId: toUserId,
                    balance: 0
                  }
                });
              }

              const memberWalletBalance = memberWallet.balance || 0;

              if (pvDestination === 'rank') {
                // Top-Up to Member: record transaction history only (PV/Rank already updated)
                await prisma.walletTransaction.create({
                  data: {
                    walletId: memberWallet.id,
                    type: 'credit',
                    amount: totalPVValue, // Positive amount
                    balanceBefore: memberWalletBalance,
                    balanceAfter: memberWalletBalance, // Wallet balance unchanged (PV is in user.pv)
                    description: `Top-Up from ${senderDetails?.fullName || 'AdminStock'} (${senderDetails?.storeOwnerLevel || ''}): ${productNames.join(', ')}`,
                    referenceId: transferId,
                    referenceType: 'rank_topup', // Shows in history, excluded from PV/Stock and PV/Product
                    status: 'completed',
                    createdAt: new Date()
                  }
                });

                logger.info(`Transaction history created for member after AdminStock top-up (PV/Rank)`, {
                  transferId,
                  toUserId,
                  fromUserId,
                  totalPVValue,
                  productNames,
                  referenceType: 'rank_topup'
                });
              } else {
                // Transfer to Member: send PV to PV/Product (product_purchase)
                await prisma.walletTransaction.create({
                  data: {
                    walletId: memberWallet.id,
                    type: 'credit',
                    amount: totalPVValue,
                    balanceBefore: memberWalletBalance,
                    balanceAfter: memberWalletBalance,
                    description: `PV Transfer from ${senderDetails?.fullName || 'AdminStock'} (${senderDetails?.storeOwnerLevel || ''}): ${productNames.join(', ')}`,
                    referenceId: transferId,
                    referenceType: 'product_purchase', // Counts as PV/Product
                    status: 'completed',
                    createdAt: new Date()
                  }
                });

                logger.info(`PV/Product transfer created for member after AdminStock transfer`, {
                  transferId,
                  toUserId,
                  fromUserId,
                  totalPVValue,
                  productNames,
                  referenceType: 'product_purchase'
                });
              }
            } catch (memberTxError: any) {
              // Log but don't fail the transfer if transaction creation fails
              logger.warn('Failed to create transaction history for member', {
                error: memberTxError.message,
                transferId,
                toUserId,
                totalPVValue
              });
            }
          }

          logger.info(`AdminStock transfer to member completed`, {
            transferId,
            fromUserId,
            toUserId,
            senderLevel: sender?.storeOwnerLevel,
            recipientLevel: recipient?.storeOwnerLevel,
            pvDestination
          });
        } else {
          // For stockist-to-stockist transfers, create wallet transactions (shows in PV/Stock)
          // Calculate total PV value of transferred stock
          let totalPVValue = 0;
          const productNames: string[] = [];
          
          for (const item of items) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { pv: true, name: true }
            });
            
            if (product) {
              const itemPV = (product.pv || 0) * item.quantity;
              totalPVValue += itemPV;
              productNames.push(`${item.quantity}x ${product.name}`);
            }
          }

          // Only create wallet transactions if there's PV value
          if (totalPVValue > 0) {
            // Create wallet transaction for seller (debit - stock leaving)
            try {
              // Get or create wallet for seller
              let sellerWallet = await prisma.wallet.findUnique({
                where: { userId: fromUserId }
              });

              if (!sellerWallet) {
                sellerWallet = await prisma.wallet.create({
                  data: {
                    userId: fromUserId,
                    balance: 0
                  }
                });
              }

              // Get current wallet balance for transaction record
              const sellerWalletBalance = sellerWallet.balance || 0;

              // Create wallet transaction showing PV deduction (for PV/Stock tracking)
              // Note: This doesn't affect wallet.balance or user.pv - it's just for transaction history
              // E-Cash page filters by referenceType 'stock_transfer' to show these as PV/Stock
              await prisma.walletTransaction.create({
                data: {
                  walletId: sellerWallet.id,
                  type: 'debit',
                  amount: -totalPVValue, // Negative amount to show as deduction
                  balanceBefore: sellerWalletBalance,
                  balanceAfter: sellerWalletBalance, // Wallet balance unchanged
                  description: `Stock Transfer: ${productNames.join(', ')}`,
                  referenceId: transferId,
                  referenceType: 'stock_transfer', // This is what E-Cash page filters by for PV/Stock
                  status: 'completed',
                  createdAt: new Date()
                }
              });

              logger.info(`Stock transfer wallet transaction created for seller`, {
                transferId,
                fromUserId,
                totalPVValue,
                productNames
              });
            } catch (sellerWalletError: any) {
              // Log but don't fail the transfer if wallet transaction creation fails
              logger.warn('Failed to create wallet transaction for seller', {
                error: sellerWalletError.message,
                transferId,
                fromUserId,
                totalPVValue
              });
            }

            // Create wallet transaction for buyer (credit - stock received)
            try {
              // Get or create wallet for buyer
              let buyerWallet = await prisma.wallet.findUnique({
                where: { userId: toUserId }
              });

              if (!buyerWallet) {
                buyerWallet = await prisma.wallet.create({
                  data: {
                    userId: toUserId,
                    balance: 0
                  }
                });
              }

              // Get current wallet balance for transaction record
              const buyerWalletBalance = buyerWallet.balance || 0;

              // Create wallet transaction showing PV credit (for PV/Stock tracking)
              // Note: This doesn't affect wallet.balance or user.pv - it's just for transaction history
              // E-Cash page filters by referenceType 'stock_transfer' to show these as PV/Stock
              await prisma.walletTransaction.create({
                data: {
                  walletId: buyerWallet.id,
                  type: 'credit',
                  amount: totalPVValue, // Positive amount to show as credit
                  balanceBefore: buyerWalletBalance,
                  balanceAfter: buyerWalletBalance, // Wallet balance unchanged
                  description: `Stock Transfer: ${productNames.join(', ')}`,
                  referenceId: transferId,
                  referenceType: 'stock_transfer', // This is what E-Cash page filters by for PV/Stock
                  status: 'completed',
                  createdAt: new Date()
                }
              });

              logger.info(`Stock transfer wallet transaction created for buyer`, {
                transferId,
                toUserId,
                totalPVValue,
                productNames
              });
            } catch (buyerWalletError: any) {
              // Log but don't fail the transfer if buyer wallet transaction creation fails
              logger.warn('Failed to create wallet transaction for buyer', {
                error: buyerWalletError.message,
                transferId,
                toUserId,
                totalPVValue
              });
            }
          }
        }
      } catch (walletTransactionError: any) {
        // Log but don't fail the transfer if wallet transaction creation fails
        // The stock transfer already completed successfully
        logger.error('Failed to create wallet transactions for stock transfer', {
          error: walletTransactionError.message,
          transferId,
          fromUserId,
          toUserId
        });
      }
    }

    // Calculate and create commission for admin stockist if applicable
    // Uses new Binary Stock Commission System with differential commission and delayed payout logic
    if (fromUserId !== 'system' && fromUserId !== toUserId) {
      try {
        // Get the seller's (admin stockist) information
        const seller = await prisma.user.findUnique({
          where: { id: fromUserId },
          select: {
            id: true,
            storeOwnerLevel: true,
            companyId: true,
            active: true
          }
        });

        // Check if seller is an admin stockist with a valid level (S, M, C, or D)
        if (seller && seller.active && seller.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(seller.storeOwnerLevel)) {
          // Calculate total PV value of stock transferred
          // Commission is based on PV value, NOT dollar amount
          let totalPVValue = 0;
          const itemDetails: Array<{ productName: string; quantity: number; pv: number; itemPV: number }> = [];
          
          for (const item of items) {
            // Fetch product to get PV value (not price)
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { pv: true, name: true, price: true }
            });
            
            if (!product) {
              logger.warn(`Product ${item.productId} not found for commission calculation`);
              continue;
            }
            
            // Calculate PV for this item: quantity × product PV
            // Example: 10 units × 100 PV = 1000 PV
            const productPV = product.pv || 0;
            const itemPV = productPV * item.quantity;
            totalPVValue += itemPV;
            
            itemDetails.push({
              productName: product.name,
              quantity: item.quantity,
              pv: productPV,
              itemPV: itemPV
            });
          }

          // Only create commission if PV value > 0
          if (totalPVValue > 0) {
            // Get recipient's stockist level
            const recipient = await prisma.user.findUnique({
              where: { id: toUserId },
              select: { storeOwnerLevel: true }
            });
            
            const sellerLevel = seller.storeOwnerLevel as 'S' | 'M' | 'C' | 'D';
            const recipientLevel = recipient?.storeOwnerLevel as 'S' | 'M' | 'C' | 'D' | null | undefined;
            
            // Use Binary Stock Commission Service to calculate differential commission
            const { 
              createBinaryStockCommission, 
              calculateDifferentialCommissionRate 
            } = await import('./binary-stock-commission-service');
            
            const { stockistLevelCommissions } = await import('@/lib/types');
            
            // CRITICAL: Commissions are ONLY created when selling to a NEW regular user
            // NOT when transferring between stockists (stockist to stockist = no commission)
            // Example: D transfers to M → No commission (M is just storing stock)
            //          M transfers to NEW user → NOW create commissions (M gets 1.7%, D gets 1.3%)
            
            if (!recipientLevel) {
              // Recipient is a regular user (not a stockist) - CREATE COMMISSIONS
              
              // Calculate base commission for the seller (stockist who sold to new user)
              const baseCommissionRate = stockistLevelCommissions[sellerLevel];
              const baseCommissionAmount = Math.round((totalPVValue * baseCommissionRate / 100) * 100) / 100;
              
              // Create commission for the seller (stockist who sold to new user)
              await createBinaryStockCommission({
                sellerId: fromUserId,
                buyerId: toUserId,
                sellerLevel,
                buyerLevel: null, // Regular user
                pvAmount: totalPVValue,
                commissionRate: baseCommissionRate,
                commissionAmount: baseCommissionAmount,
                transferId,
                companyId: seller.companyId || companyId || undefined,
                itemDetails
              } as any);

              logger.info(`Base commission created for stockist selling to new user`, {
                stockistId: fromUserId,
                stockistLevel: sellerLevel,
                recipientId: toUserId,
                recipientType: 'Regular User',
                totalPVValue,
                commissionRate: `${baseCommissionRate}%`,
                commissionAmount: `$${baseCommissionAmount.toFixed(2)}`,
                transferId
              });

              // CRITICAL FIX: When a stockist transfers to a new user, walk up the binary
              // stock chain and create differential commissions for ALL eligible upline stockists.
              //
              // IMPORTANT: Each upline receives commission ONLY from their DIRECT downline
              // in the placementParentId chain. This ensures no duplicate commissions.
              //
              // Example chain: Adminstock D → C → M → S → New User (1000 PV)
              // - S gets base 0.8% (already created above)
              // - M receives 0.9% from S (1.7% - 0.8%) - M is S's direct parent
              // - C receives 0.9% from M (2.6% - 1.7%) - C is M's direct parent
              // - D receives 0.4% from C (3.0% - 2.6%) - D is C's direct parent
              // 
              // D will NOT get 1.3% from M because M is not D's direct downline in this chain.
              //
              // CRITICAL: When D sells directly, if M is D's parent (lower level), NO commission for M.
              try {
                console.log(`[BINARY STOCK COMMISSION] Starting chain walk for seller ${fromUserId} (${sellerLevel}) selling ${totalPVValue} PV to new user`);
                console.log(`[BINARY STOCK COMMISSION] Seller hierarchy: ${stockistLevelHierarchy[sellerLevel]}`);
                
                // Start from the selling stockist and move upwards via placementParentId
                let currentDownlineId: string | null = fromUserId;
                let currentDownlineLevel: 'S' | 'M' | 'C' | 'D' = sellerLevel;
                const visited = new Set<string>();
                const commissionsCreated = new Set<string>(); // Track which uplines already got commissions to prevent duplicates
                let safetyDepth = 0;
                
                // CRITICAL: Store original seller info to prevent any reverse commissions
                const originalSellerId = fromUserId;
                const originalSellerLevel = sellerLevel;
                const originalSellerHierarchy = stockistLevelHierarchy[sellerLevel];

                while (currentDownlineId && safetyDepth < 10) {
                  if (visited.has(currentDownlineId)) {
                    break;
                  }
                  visited.add(currentDownlineId);
                  safetyDepth += 1;

                  // Get the current downline's placementParentId (their direct upline)
                  const currentUser: { placementParentId: string | null } | null = await prisma.user.findUnique({
                    where: { id: currentDownlineId },
                    select: {
                      placementParentId: true
                    }
                  });

                  const uplineId: string | null = currentUser?.placementParentId || null;
                  if (!uplineId) {
                    break;
                  }

                  // CRITICAL: Skip if we already created a commission for this upline (prevent duplicates)
                  // This can happen if there are multiple paths in the binary tree
                  if (commissionsCreated.has(uplineId)) {
                    logger.debug(`Skipping duplicate commission for upline ${uplineId} (already processed)`);
                    // Move further up the chain but skip commission creation
                    currentDownlineId = uplineId;
                    continue;
                  }

                  // Get the upline stockist
                  const upline: { id: string; storeOwnerLevel: string | null; companyId: string | null; active: boolean } | null =
                    await prisma.user.findUnique({
                    where: { id: uplineId },
                    select: {
                      id: true,
                      storeOwnerLevel: true,
                      companyId: true,
                      active: true
                    }
                  });

                  if (!upline || !upline.active || !upline.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(upline.storeOwnerLevel)) {
                    // Move further up the chain but do not create commission for this node
                    currentDownlineId = uplineId;
                    continue;
                  }

                  const uplineLevel = upline.storeOwnerLevel as 'S' | 'M' | 'C' | 'D';

                  // CRITICAL: Skip commission if upline level is LOWER than or EQUAL to downline level
                  // This prevents reverse commission (e.g., D sells directly, M is D's parent but lower level = no commission)
                  // Example: D (3.0%) has M (1.7%) as parent → D sells directly → M should NOT get commission
                  const uplineHierarchy = stockistLevelHierarchy[uplineLevel];
                  const downlineHierarchy = stockistLevelHierarchy[currentDownlineLevel];
                  
                  console.log(`[BINARY STOCK COMMISSION] Checking hierarchy: Upline ${uplineLevel} (${uplineHierarchy}) vs Downline ${currentDownlineLevel} (${downlineHierarchy})`);
                  console.log(`[BINARY STOCK COMMISSION] Original seller: ${originalSellerId} (${originalSellerLevel}, hierarchy: ${originalSellerHierarchy})`);
                  
                  // STRICT CHECK: Upline MUST be higher level than downline to receive commission
                  // This is the PRIMARY check - if upline is not higher, skip immediately
                  // ALSO CHECK: Upline must be higher than ORIGINAL seller (defensive check)
                  if (uplineHierarchy <= downlineHierarchy || uplineHierarchy <= originalSellerHierarchy) {
                    // Upline is same or lower level than downline = NO COMMISSION (selling upward)
                    const skipMessage = `SKIPPING COMMISSION: Upline ${uplineLevel} (hierarchy: ${uplineHierarchy}) is NOT higher than downline ${currentDownlineLevel} (hierarchy: ${downlineHierarchy}) OR original seller ${originalSellerLevel} (${originalSellerHierarchy}). This prevents reverse commission.`;
                    console.log(`[BINARY STOCK COMMISSION] ❌ ${skipMessage}`);
                    logger.warn(skipMessage, {
                      uplineId: upline.id,
                      uplineLevel,
                      uplineHierarchy,
                      downlineId: currentDownlineId,
                      downlineLevel: currentDownlineLevel,
                      downlineHierarchy,
                      originalSeller: fromUserId,
                      originalSellerLevel: sellerLevel,
                      originalSellerHierarchy,
                      pvAmount: totalPVValue
                    });
                    // CRITICAL: When we find a lower-level upline, STOP the chain walk entirely
                    // We should NOT continue walking up because all further uplines will also be invalid
                    console.log(`[BINARY STOCK COMMISSION] 🛑 STOPPING chain walk - found lower-level upline ${uplineLevel}`);
                    break; // STOP the chain walk, don't continue
                  }
                  
                  console.log(`[BINARY STOCK COMMISSION] ✅ Hierarchy check passed: Upline ${uplineLevel} (${uplineHierarchy}) > Downline ${currentDownlineLevel} (${downlineHierarchy})`);

                  // DOUBLE CHECK: Verify upline is still higher level (defensive programming)
                  // This ensures we never create reverse commissions
                  if (uplineHierarchy <= downlineHierarchy) {
                    logger.error(`CRITICAL: Hierarchy check failed! Attempted to create commission for upline ${uplineLevel} (${uplineHierarchy}) from downline ${currentDownlineLevel} (${downlineHierarchy}). This should have been caught earlier.`, {
                      uplineId: upline.id,
                      uplineLevel,
                      downlineId: currentDownlineId,
                      downlineLevel: currentDownlineLevel
                    });
                    // Move up chain but DO NOT create commission
                    currentDownlineId = upline.id;
                    currentDownlineLevel = uplineLevel;
                    continue;
                  }

                  // Only calculate differential if upline is higher level
                  // Calculate differential commission for this upline versus its direct downline
                  const differentialRate = calculateDifferentialCommissionRate(uplineLevel, currentDownlineLevel);

                  // TRIPLE CHECK: Ensure differential rate is positive AND upline is higher
                  if (differentialRate > 0 && uplineHierarchy > downlineHierarchy) {
                    const commissionAmount = Math.round((totalPVValue * differentialRate / 100) * 100) / 100;

                    logger.info(`Creating differential commission for upline stockist in binary chain`, {
                      uplineId: upline.id,
                      uplineLevel,
                      uplineHierarchy,
                      downlineId: currentDownlineId,
                      downlineLevel: currentDownlineLevel,
                      downlineHierarchy,
                      pvAmount: totalPVValue,
                      differentialRate: `${differentialRate}%`,
                      commissionAmount: `$${commissionAmount.toFixed(2)}`,
                      isDirectRelationship: true,
                      hierarchyCheck: `Upline ${uplineHierarchy} > Downline ${downlineHierarchy} = ${uplineHierarchy > downlineHierarchy}`
                    });

                    // FINAL SAFETY CHECK: Never create commission if upline is not higher
                    // This is the ABSOLUTE FINAL check before commission creation
                    if (uplineHierarchy <= downlineHierarchy) {
                      const abortMessage = `ABORTING COMMISSION CREATION: Final safety check failed! Upline ${uplineLevel} (${uplineHierarchy}) is NOT higher than downline ${currentDownlineLevel} (${downlineHierarchy}). Commission creation aborted.`;
                      console.error(`[BINARY STOCK COMMISSION] 🚫 ${abortMessage}`);
                      logger.error(abortMessage, {
                        uplineId: upline.id,
                        uplineLevel,
                        downlineId: currentDownlineId,
                        downlineLevel: currentDownlineLevel,
                        differentialRate,
                        commissionAmount,
                        originalSeller: fromUserId,
                        originalSellerLevel: sellerLevel
                      });
                      // DO NOT create commission - skip it and move up chain
                      currentDownlineId = upline.id;
                      currentDownlineLevel = uplineLevel;
                      continue;
                    }
                    
                    // VERIFY: One more time before creating commission
                    // CRITICAL: Verify that buyerId matches currentDownlineId (the one who sold)
                    // and sellerId matches upline.id (the one receiving commission)
                    if (currentDownlineId !== fromUserId && currentDownlineLevel !== sellerLevel) {
                      // This means we've moved up the chain, which is correct
                      // But verify the hierarchy one more time
                      const finalUplineHierarchy = stockistLevelHierarchy[uplineLevel];
                      const finalDownlineHierarchy = stockistLevelHierarchy[currentDownlineLevel];
                      
                      if (finalUplineHierarchy <= finalDownlineHierarchy) {
                        console.error(`[BINARY STOCK COMMISSION] 🚫 FINAL ABORT: Upline ${uplineLevel} (${finalUplineHierarchy}) <= Downline ${currentDownlineLevel} (${finalDownlineHierarchy})`);
                        currentDownlineId = upline.id;
                        currentDownlineLevel = uplineLevel;
                        continue;
                      }
                    }
                    
                    // ABSOLUTE FINAL CHECK: Throw error if hierarchy is wrong (this should never happen)
                    const finalCheckUplineHierarchy = stockistLevelHierarchy[uplineLevel];
                    const finalCheckDownlineHierarchy = stockistLevelHierarchy[currentDownlineLevel];
                    
                    if (finalCheckUplineHierarchy <= finalCheckDownlineHierarchy) {
                      const errorMsg = `CRITICAL ERROR: Attempted to create reverse commission! Upline ${uplineLevel} (${finalCheckUplineHierarchy}) <= Downline ${currentDownlineLevel} (${finalCheckDownlineHierarchy}). This should have been caught earlier. ABORTING.`;
                      console.error(`[BINARY STOCK COMMISSION] 🚫 ${errorMsg}`);
                      logger.error(errorMsg, {
                        uplineId: upline.id,
                        uplineLevel,
                        downlineId: currentDownlineId,
                        downlineLevel: currentDownlineLevel,
                        originalSeller: fromUserId,
                        originalSellerLevel: sellerLevel
                      });
                      // DO NOT create commission - move up chain and continue
                      currentDownlineId = upline.id;
                      currentDownlineLevel = uplineLevel;
                      continue;
                    }
                    
                    // CRITICAL VERIFICATION: Check if buyerId is the original seller
                    // When D sells directly, buyerId should be D (the original seller), not M
                    // If buyerId is M, that means we're creating a commission incorrectly
                    if (currentDownlineId !== originalSellerId && currentDownlineLevel !== originalSellerLevel) {
                      // We've moved up the chain, which is fine
                      // But verify that the upline is still higher than the original seller
                      if (uplineHierarchy <= originalSellerHierarchy) {
                        console.error(`[BINARY STOCK COMMISSION] 🚫 ABORT: Upline ${uplineLevel} (${uplineHierarchy}) is NOT higher than original seller ${originalSellerLevel} (${originalSellerHierarchy})`);
                        break; // Stop chain walk
                      }
                    }
                    
                    console.log(`[BINARY STOCK COMMISSION] ✅ Creating commission: Upline ${uplineLevel} (${uplineHierarchy}) FROM Downline ${currentDownlineLevel} (${downlineHierarchy}), Rate: ${differentialRate}%, Amount: $${commissionAmount.toFixed(2)}`);
                    console.log(`[BINARY STOCK COMMISSION] Commission params: sellerId=${upline.id} (${uplineLevel}), buyerId=${currentDownlineId} (${currentDownlineLevel}), originalSeller=${originalSellerId} (${originalSellerLevel})`);
                    
                    // ONE MORE VERIFICATION before calling createBinaryStockCommission
                    if (stockistLevelHierarchy[uplineLevel] <= stockistLevelHierarchy[currentDownlineLevel] || stockistLevelHierarchy[uplineLevel] <= originalSellerHierarchy) {
                      console.error(`[BINARY STOCK COMMISSION] 🚫 LAST CHANCE ABORT: Hierarchy check failed right before commission creation!`);
                      break; // Stop chain walk
                    }
                    
                    await createBinaryStockCommission({
                      sellerId: upline.id,
                      buyerId: currentDownlineId, // This should be the downline (D), not M
                      sellerLevel: uplineLevel,
                      buyerLevel: currentDownlineLevel,
                      pvAmount: totalPVValue,
                      commissionRate: differentialRate,
                      commissionAmount,
                      transferId: `${transferId}-upline-${safetyDepth}`,
                      companyId: upline.companyId || companyId || undefined,
                      itemDetails
                    } as any);
                    console.log(`[BINARY STOCK COMMISSION] ✅ Commission created successfully for ${uplineLevel} from ${currentDownlineLevel}`);

                    // Mark this upline as having received a commission to prevent duplicates
                    commissionsCreated.add(upline.id);
                  } else {
                    logger.warn(`Skipping commission: differentialRate=${differentialRate}, hierarchy check=${uplineHierarchy > downlineHierarchy}`, {
                      uplineLevel,
                      currentDownlineLevel,
                      uplineHierarchy,
                      downlineHierarchy
                    });
                  }

                  // Move one level up: this upline becomes the new downline for the next iteration
                  // This happens regardless of whether commission was created or skipped
                  currentDownlineId = upline.id;
                  currentDownlineLevel = uplineLevel;
                }
              } catch (uplineError) {
                // Log but don't fail the transfer
                logger.warn('Failed to create upline differential commission chain (non-blocking)', {
                  error: uplineError instanceof Error ? uplineError.message : 'Unknown error',
                  stockistId: fromUserId,
                  transferId
                });
              }
            } else {
              // Recipient is a stockist - NO COMMISSION (stockist to stockist transfer)
              // Stock is just being moved between stockists for inventory purposes
              // Commission will be created when the recipient stockist sells to a new user
              logger.info(`No commission - transferring to another stockist (inventory transfer only)`, {
                stockistId: fromUserId,
                stockistLevel: sellerLevel,
                recipientId: toUserId,
                recipientLevel: recipientLevel,
                note: 'Commission will be created when recipient sells to a new user'
              });
            }
          } else {
            logger.warn(`Total PV value is 0, no commission created`, {
              stockistId: fromUserId,
              items: items.length
            });
          }
        } else {
          // Not an admin stockist, no commission
          logger.debug(`User ${fromUserId} is not an active admin stockist, skipping commission`);
        }
      } catch (commissionError) {
        // Log error but don't fail the stock transfer
        console.error('❌ Failed to create binary stock commission:', commissionError);
        logger.error('Failed to create binary stock commission', {
          error: commissionError instanceof Error ? commissionError.message : 'Unknown error',
          stack: commissionError instanceof Error ? commissionError.stack : undefined,
          fromUserId,
          toUserId,
          transferId
        });
      }
    }

    // After successful stock transfer, credit the member's wallet with PV
    // Check if sender is admin or system to credit recipient's wallet
    const sender = await prisma.user.findUnique({
      where: { id: fromUserId === 'system' ? 'admin' : fromUserId },
      select: { isAdmin: true, id: true }
    }).catch(() => null);
    
    const isAdminTransfer = fromUserId === 'system' || sender?.isAdmin === true;
    
    console.log('🔍 Checking if wallet credit is needed', {
      fromUserId,
      toUserId,
      transferId,
      isSystemTransfer: fromUserId === 'system',
      isAdminTransfer,
      senderIsAdmin: sender?.isAdmin
    });
    
    if (isAdminTransfer) {
      // Only credit wallet for admin-to-member transfers (not user-to-user)
      // Calculate total PV value from stock items (not price)
      let totalPVValue = 0;
      
      console.log('🔍 Starting PV calculation for stock transfer', {
        itemCount: items.length,
        items: items.map(i => ({ productName: i.productName, quantity: i.quantity }))
      });
      
      for (const item of items) {
        console.log(`🔎 Looking up StockItem for: "${item.productName}"`);
        
        // Try exact match first
        let stockItem = await prisma.stockItem.findFirst({
          where: { 
            name: item.productName,
            companyId: companyId || undefined
          }
        });
        
        // If not found, try case-insensitive search with all stock items
        if (!stockItem) {
          const allStockItems = await prisma.stockItem.findMany({
            where: {
              companyId: companyId || undefined
            }
          });
          
          // Normalize both strings: remove extra spaces, lowercase
          const normalizedSearchName = item.productName.replace(/\s+/g, ' ').trim().toLowerCase();
          
          stockItem = allStockItems.find(si => {
            const normalizedItemName = si.name.replace(/\s+/g, ' ').trim().toLowerCase();
            return normalizedItemName === normalizedSearchName;
          }) || null;
          
          console.log(`🔍 Fallback search result:`, {
            searchName: item.productName,
            normalizedSearch: normalizedSearchName,
            found: !!stockItem,
            matchedName: stockItem?.name
          });
        }
        
        console.log(`📋 StockItem lookup result:`, {
          productName: item.productName,
          found: !!stockItem,
          stockItemName: stockItem?.name,
          pv: stockItem?.pv
        });
        
        const itemPV = stockItem?.pv || 0;
        const totalItemPV = itemPV * item.quantity;
        totalPVValue += totalItemPV;
        
        console.log(`📦 Stock item PV calculation:`, {
          productName: item.productName,
          itemPV,
          quantity: item.quantity,
          totalItemPV,
          runningTotal: totalPVValue
        });
      }
      
      const pvAmount = totalPVValue; // Use actual PV from stock items

      console.log('💰 Calculating PV for stock transfer', {
        transferId,
        toUserId,
        pvAmount,
        totalPVValue,
        itemCount: items.length,
        items: items.map(i => ({ 
          productId: i.productId, 
          productName: i.productName,
          quantity: i.quantity, 
          unitPrice: i.unitPrice 
        }))
      });

      logger.info(`Preparing to credit wallet for stock transfer`, {
        transferId,
        toUserId,
        pvAmount,
        totalPVValue,
        itemCount: items.length,
        items: items.map(i => ({ 
          productId: i.productId, 
          productName: i.productName,
          quantity: i.quantity, 
          unitPrice: i.unitPrice 
        }))
      });

      // Always attempt to credit wallet if pvAmount > 0 (even if small)
      console.log('🔎 Checking pvAmount', { pvAmount, willCredit: pvAmount > 0 });
      
      if (pvAmount > 0) {
        try {
          // Ensure amount meets minimum requirement (0.01)
          const creditAmount = Math.max(pvAmount, 0.01);
          
          console.log('🔄 CREDITING WALLET FOR STOCK TRANSFER', {
            toUserId,
            creditAmount,
            pvAmount,
            transferId,
            items: items.map(i => `${i.quantity}x ${i.productName} ($${i.unitPrice})`),
            description: `Stock Transfer: ${items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}`,
            referenceType: 'stock_transfer'
          });
          
          // Credit the member's wallet with PV
          const walletResult = await WalletServiceEnhanced.creditWallet(
            toUserId,
            creditAmount,
            `Stock Transfer: ${items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}`,
            transferId,
            'stock_transfer'
          );

          console.log('✅✅✅ WALLET CREDITED SUCCESSFULLY ✅✅✅', {
            transferId,
            toUserId,
            walletId: walletResult.id,
            creditAmount,
            newBalance: walletResult.balance,
            referenceType: 'stock_transfer'
          });

          logger.info(`Wallet credited with PV from stock transfer`, {
            transferId,
            toUserId,
            pvAmount,
            creditAmount,
            itemCount: items.length,
            walletId: walletResult.id,
            newBalance: walletResult.balance
          });
        } catch (walletError) {
          // Log error but don't fail the stock transfer
          const errorMessage = walletError instanceof Error ? walletError.message : 'Unknown error';
          const errorStack = walletError instanceof Error ? walletError.stack : undefined;
          
          console.error('❌ CRITICAL: Wallet credit failed for stock transfer', {
            toUserId,
            pvAmount,
            error: errorMessage,
            errorStack,
            transferId,
            items: items.map(i => ({ 
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity, 
              unitPrice: i.unitPrice 
            }))
          });
          
          logger.error('Failed to credit wallet after stock transfer', {
            error: errorMessage,
            errorStack,
            transferId,
            toUserId,
            pvAmount,
            totalPVValue,
            items: items.map(i => ({ 
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity, 
              unitPrice: i.unitPrice 
            }))
          });
          
          // IMPORTANT: Don't fail the stock transfer, but log the error
          // The stock transfer succeeded, but wallet credit failed
          console.error('❌ Wallet credit failed but stock transfer succeeded', {
            toUserId,
            pvAmount,
            error: errorMessage,
            totalPVValue
          });
        }
      } else {
        console.warn('⚠️ PV amount is 0 or negative, skipping wallet credit', {
          transferId,
          toUserId,
          pvAmount,
          totalPVValue,
          items: items.map(i => ({ 
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity, 
            unitPrice: i.unitPrice 
          }))
        });
        
        logger.warn(`PV amount is 0 or negative, skipping wallet credit`, {
          transferId,
          toUserId,
          pvAmount,
          totalPVValue,
          items: items.map(i => ({ 
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity, 
            unitPrice: i.unitPrice 
          }))
        });
      }
    } else {
      console.log('ℹ️ Skipping wallet credit - not a system transfer', {
        fromUserId,
        toUserId,
        transferId
      });
    }

    return { success: true, transferId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to transfer stock', {
      error: errorMessage,
      fromUserId,
      toUserId,
      itemCount: items.length
    });
    return { 
      success: false,
      message: errorMessage
    };
  }
}

/**
 * Record an inventory transaction (for manual adjustments)
 */
export async function recordTransaction(
  productId: string,
  type: 'purchase' | 'sale' | 'transfer' | 'adjustment' | 'return',
  quantity: number,
  reference?: string,
  userId?: string,
  reason?: string,
  companyId?: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type,
          quantity,
          previousQty: product.qty,
          newQty: product.qty, // Same as previous since this is just recording
          reference,
          reason,
          companyId,
          createdBy: userId || 'system'
        }
      });
    });

    return true;
  } catch (error) {
    logger.error('Failed to record transaction', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      type,
      quantity
    });
    return false;
  }
}

/**
 * Get inventory transaction history
 */
export async function getInventoryHistory(
  productId?: string,
  userId?: string,
  companyId?: string,
  limit: number = 100
): Promise<InventoryTransaction[]> {
  try {
    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return transactions as InventoryTransaction[];
  } catch (error) {
    logger.error('Failed to get inventory history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      userId
    });
    return [];
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(
  threshold: number = 10,
  companyId?: string
): Promise<Array<{ id: string; name: string; qty: number; category: string }>> {
  try {
    const where: any = {
      qty: { lte: threshold },
      isActive: true
    };

    if (companyId) {
      where.companyId = companyId;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        qty: true,
        category: true
      },
      orderBy: { qty: 'asc' }
    });

    return products;
  } catch (error) {
    logger.error('Failed to get low stock products', {
      error: error instanceof Error ? error.message : 'Unknown error',
      threshold
    });
    return [];
  }
}

/**
 * Adjust stock levels (for corrections, audits, etc.)
 */
export async function adjustStockLevels(
  productId: string,
  newQuantity: number,
  reason: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const previousQty = product.qty;
      const difference = newQuantity - previousQty;

      // Update product quantity
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQuantity }
      });

      // Record adjustment transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: 'adjustment',
          quantity: Math.abs(difference),
          previousQty,
          newQty: newQuantity,
          reason,
          companyId,
          createdBy: userId
        }
      });

      logger.info(`Stock adjusted`, {
        productId,
        product: product.name,
        previousQty,
        newQuantity,
        difference,
        reason
      });
    });

    return true;
  } catch (error) {
    logger.error('Failed to adjust stock levels', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      newQuantity
    });
    return false;
  }
}

/**
 * Get inventory statistics
 */
export async function getInventoryStatistics(companyId?: string): Promise<{
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}> {
  try {
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const [products, totalStockAgg, lowStock, outOfStock] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.aggregate({
        where,
        _sum: { qty: true }
      }),
      prisma.product.count({
        where: { ...where, qty: { lte: 10, gt: 0 } }
      }),
      prisma.product.count({
        where: { ...where, qty: 0 }
      })
    ]);

    return {
      totalProducts: products,
      totalStock: totalStockAgg._sum.qty || 0,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      totalValue: 0 // Would need qty * price calculation
    };
  } catch (error) {
    logger.error('Failed to get inventory statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      totalProducts: 0,
      totalStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: 0
    };
  }
}