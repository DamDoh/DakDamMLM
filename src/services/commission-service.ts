import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { WalletService } from './wallet-service';
import { realtimeService } from './realtime-service';
import { blockchainAuditService } from './blockchain-audit-service';

export interface CommissionData {
  id: string;
  userId: string;
  amount: number;
  type: string;
  status: 'Pending' | 'Paid' | 'Cancelled';
  date: Date;
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
      date: commission.date
    };
  }

  /**
   * Pay commission to wallet
   */
  static async payCommission(commissionId: string): Promise<CommissionData> {
    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
      include: { company: true }
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

    // Add commission to E-Cash (E-Cash stores ONLY commissions)
    try {
      const { addCommissionToECash } = await import('./e-cash-service');
      await addCommissionToECash(
        commission.userId,
        commission.amount,
        commission.id,
        commission.type
      );
    } catch (eCashError: any) {
      logger.warn('Failed to add commission to E-Cash (non-critical)', {
        error: eCashError.message,
        userId: commission.userId,
        commissionId: commission.id
      });
      // Continue - E-Cash addition failure shouldn't break commission payment
    }

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
      date: updatedCommission.date
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
      date: commission.date
    }));
  }

  /**
   * Calculate binary commissions for a user
   */
  static async calculateBinaryCommission(userId: string): Promise<number> {
    // Use the enhanced calculation engine which properly traverses binary tree
    const { CommissionCalculationEngineEnhanced } = await import('./commission-calculation-engine-enhanced');
    
    // Calculate for current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    try {
      const calculation = await CommissionCalculationEngineEnhanced.calculateMemberCommission(
        userId,
        startDate,
        endDate
      );

      // Log calculation details for debugging
      console.log(`Binary commission calculation for user ${userId}:`, {
        qualificationMet: calculation.qualificationMet,
        commissionAmount: calculation.commissionAmount,
        leftVolume: calculation.leftVolume,
        rightVolume: calculation.rightVolume,
        weakerLeg: calculation.weakerLeg,
        commissionRate: calculation.commissionRate
      });

      // Return the commission amount if qualification is met
      return calculation.qualificationMet ? calculation.commissionAmount : 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error calculating binary commission for user ${userId}:`, errorMessage, error);
      return 0;
    }
  }

  /**
   * Calculate stockist bonus for a user based on their stockist level and PV
   * 
   * DEPRECATED: This method is no longer used for automatic Stockist Bonus calculation.
   * Stockist Bonus is now ONLY created when Admin Stock transfers PV to members.
   * See inventory-service.ts transferStock() function for the new implementation.
   * 
   * This method is kept for backward compatibility but always returns 0.
   */
  static async calculateStockistBonus(userId: string): Promise<number> {
    console.log(`[Stockist Bonus] ⚠️ DEPRECATED: calculateStockistBonus called for user ${userId}`);
    console.log(`[Stockist Bonus] Stockist Bonus is now ONLY created on PV transfers, not automatically.`);
    console.log(`[Stockist Bonus] See inventory-service.ts transferStock() for the new implementation.`);
    return 0;
  }

  /**
   * Run commission cycle for all eligible users
   */
  static async runCommissionCycle(companyId?: string): Promise<{
    processed: number;
    totalAmount: number;
    errors: string[];
    matchingBonusCount?: number;
    matchingBonusTotal?: number;
  }> {
    const result = {
      processed: 0,
      totalAmount: 0,
      errors: [] as string[],
      matchingBonusCount: 0,
      matchingBonusTotal: 0
    };

    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: {
          active: true,
          ...(companyId && { companyId })
        },
        select: {
          id: true,
          memberId: true,
          rank: true
        }
      });

      console.log(`📊 Starting commission cycle for ${users.length} users...`);

      // Process users sequentially with progress logging
      let processedCount = 0;
      const totalUsers = users.length;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (i % 10 === 0) {
          console.log(`📊 Progress: ${i}/${totalUsers} users processed...`);
        }
        try {
          const now = new Date();
          const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

          // Calculate Binary Bonus
          const binaryCommissionAmount = await this.calculateBinaryCommission(user.id);

          if (binaryCommissionAmount > 0) {
            // Check if commission already exists for this period to avoid duplicates
            const existingBinaryCommission = await prisma.commission.findFirst({
              where: {
                userId: user.id,
                type: 'Binary Bonus',
                date: {
                  gte: startDate,
                  lte: endDate
                },
                status: { in: ['Paid', 'Pending'] }
              }
            });

            if (!existingBinaryCommission) {
              // Create commission
              const commission = await this.createCommission(
                user.id,
                binaryCommissionAmount,
                'Binary Bonus',
                undefined, // description parameter (not used in schema)
                companyId
              );

              // Pay commission immediately (in production, this might be batched)
              await this.payCommission(commission.id);

              // Send notification to user about Binary Bonus commission earned
              try {
                await prisma.notification.create({
                  data: {
                    memberId: user.id,
                    type: 'in_app',
                    category: 'commission',
                    title: `Binary Bonus Earned: $${binaryCommissionAmount.toFixed(2)}`,
                    body: `You earned $${binaryCommissionAmount.toFixed(2)} in Binary Bonus based on your team's performance.`,
                    data: {
                      commissionId: commission.id,
                      commissionType: 'Binary Bonus',
                      amount: binaryCommissionAmount,
                      link: '/commission' // Navigate to commission page
                    },
                    priority: 'high',
                    isRead: false,
                    isSent: false
                  }
                });
              } catch (notifError: any) {
                logger.warn('Failed to create Binary Bonus notification', {
                  error: notifError.message,
                  userId: user.id,
                  commissionId: commission.id
                });
              }

              result.processed++;
              result.totalAmount += binaryCommissionAmount;
              processedCount++;
              console.log(`✅ [${i + 1}/${totalUsers}] Binary Bonus for ${user.memberId || user.id}: $${binaryCommissionAmount.toFixed(2)}`);
            } else {
              console.log(`⏭️  [${i + 1}/${totalUsers}] Skipped ${user.memberId || user.id}: Binary Bonus already exists for this period`);
            }
          } else {
            console.log(`ℹ️  [${i + 1}/${totalUsers}] No Binary Bonus for ${user.memberId || user.id}: Amount = $0`);
          }

          // Calculate Matching Bonus - uses Daily Match commissions from downlines
          // Import the calculation engine
          const { CommissionCalculationEngineEnhanced } = await import('./commission-calculation-engine');
          
          // Get user's rank for Matching Bonus calculation
          const userWithRank = await prisma.user.findUnique({
            where: { id: user.id },
            select: { rank: true }
          });

          if (userWithRank && userWithRank.rank) {
            // Calculate Matching Bonus for this user
            const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
              user.id,
              startDate,
              endDate,
              userWithRank.rank
            );

            // Filter out zero-amount entries
            const validMatchingBonuses = matchingBonuses.filter(b => b.amount > 0);

            if (validMatchingBonuses.length > 0) {
              // Process each Matching Bonus entry (can be multiple entries for different legs/generations)
              for (const matchingBonus of validMatchingBonuses) {
                // Check if this specific Matching Bonus commission already exists
                const existingMatchingBonus = await prisma.commission.findFirst({
                  where: {
                    userId: user.id,
                    type: 'Matching Bonus',
                    date: {
                      gte: startDate,
                      lte: endDate
                    },
                    description: matchingBonus.description,
                    status: { in: ['Paid', 'Pending'] }
                  }
                });

                if (!existingMatchingBonus) {
                  // Create Matching Bonus commission
                  const commission = await prisma.commission.create({
                    data: {
                      userId: user.id,
                      amount: matchingBonus.amount,
                      type: 'Matching Bonus',
                      description: matchingBonus.description,
                      status: 'Pending',
                      date: new Date(),
                      metadata: matchingBonus.metadata as any,
                      companyId
                    }
                  });

                  // Pay commission immediately
                  await this.payCommission(commission.id);

                  // Send notification to user about Matching Bonus commission earned
                  try {
                    await prisma.notification.create({
                      data: {
                        memberId: user.id,
                        type: 'in_app',
                        category: 'commission',
                        title: `Matching Bonus Earned: $${matchingBonus.amount.toFixed(2)}`,
                        body: matchingBonus.description || `You earned $${matchingBonus.amount.toFixed(2)} in Matching Bonus from your downline's Daily Match.`,
                        data: {
                          commissionId: commission.id,
                          commissionType: 'Matching Bonus',
                          amount: matchingBonus.amount,
                          link: '/commission' // Navigate to commission page
                        },
                        priority: 'high',
                        isRead: false,
                        isSent: false
                      }
                    });
                  } catch (notifError: any) {
                    logger.warn('Failed to create Matching Bonus notification', {
                      error: notifError.message,
                      userId: user.id,
                      commissionId: commission.id
                    });
                  }

                  result.processed++;
                  result.totalAmount += matchingBonus.amount;
                  result.matchingBonusCount = (result.matchingBonusCount || 0) + 1;
                  result.matchingBonusTotal = (result.matchingBonusTotal || 0) + matchingBonus.amount;
                  console.log(`✅ Matching Bonus for ${user.memberId || user.id}: $${matchingBonus.amount.toFixed(2)} - ${matchingBonus.description}`);
                }
              }
            } else {
              console.log(`ℹ️  No Matching Bonus for ${user.memberId || user.id} (${userWithRank.rank}): No qualifying downline Daily Match found`);
            }
          } else {
            console.log(`ℹ️  No Matching Bonus for ${user.memberId || user.id}: No rank or rank is empty`);
          }

          // NOTE: Stockist Bonus is now triggered ONLY by PV transfers (not by monthly commission cycle)
          // Stockist Bonus is automatically created when Admin Stock transfers stock to a stockist
          // See: /src/components/admin/stock-transfer-dialog.tsx for PV-transfer-based bonus logic
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const userIdentifier = user.memberId || user.id;
          result.errors.push(`Failed to process user ${userIdentifier}: ${errorMessage}`);
          console.error(`❌ Commission calculation error for ${userIdentifier}:`, error);
          // Continue processing other users even if one fails
        }
      }
      
      console.log(`✅ Commission cycle completed: ${processedCount} commissions created for ${totalUsers} users`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Commission cycle failed: ${errorMessage}`);
      console.error('❌ Commission cycle failed:', error);
    }

    // Log summary
    console.log(`📊 Commission Cycle Summary:`, {
      processed: result.processed,
      totalAmount: result.totalAmount.toFixed(2),
      matchingBonusCount: result.matchingBonusCount || 0,
      matchingBonusTotal: (result.matchingBonusTotal || 0).toFixed(2),
      errors: result.errors.length,
      errorDetails: result.errors.slice(0, 5) // Show first 5 errors
    });

    if (result.errors.length > 0) {
      console.warn(`⚠️ Commission cycle completed with ${result.errors.length} errors. Check logs for details.`);
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
          undefined, // description parameter (not used in schema)
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
