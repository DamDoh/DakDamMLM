import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { shouldUpdateRank, type Rank } from '@/lib/rank';

// PUT: convert PV from product purchases into PV/Rank
export async function PUT(request: NextRequest) {
  try {
    let auth: AuthenticatedRequest;
    let user: AuthenticatedRequest['user'];
    try {
      auth = await authenticateRequest(request);
      user = auth.user;
    } catch (err) {
      const message = err instanceof AuthenticationError ? err.message : 'Authentication required';
      return NextResponse.json({ error: 'Unauthorized', message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'User not found' }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100000, // Optimized for 100M+ users
      keyGenerator: () => `rank-topup:${user.id}`,
    });
    if (!rateLimitResult.success) return rateLimitResult.response!;

    const requestBody = await request.json().catch(() => ({}));
    const requestedAmount = typeof requestBody?.amount === 'number' ? Number(requestBody.amount) : undefined;
    const targetMemberId = typeof requestBody?.targetMemberId === 'string' ? requestBody.targetMemberId : undefined;

    // Fetch user from database to get storeOwnerLevel (not in auth token)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, storeOwnerLevel: true, active: true, deleted: true },
    });

    if (!dbUser || dbUser.deleted || !dbUser.active) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 });
    }

    // Check if user is Admin Stock (can top up for others)
    const isAdminStock = dbUser.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(dbUser.storeOwnerLevel);
    
    // Determine target user ID
    const targetUserId = targetMemberId && isAdminStock ? targetMemberId : user.id;
    
    // For AdminStock: use stock_transfer, for regular members: use product_purchase
    const pvSourceType = isAdminStock ? 'stock_transfer' : 'product_purchase';
    
    // If Admin Stock is trying to top up for another member, verify they have permission
    if (targetMemberId && isAdminStock && targetMemberId !== user.id) {
      const targetMember = await prisma.user.findUnique({
        where: { id: targetMemberId },
        select: { id: true, active: true, deleted: true },
      });
      
      if (!targetMember || targetMember.deleted || !targetMember.active) {
        return NextResponse.json({ error: 'Target member not found or inactive' }, { status: 404 });
      }
    } else if (targetMemberId && !isAdminStock) {
      return NextResponse.json({ error: 'Only Admin Stock can top up for other members' }, { status: 403 });
    }

    // Get wallet for the user performing the action (to check their available PV)
    let wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          currency: 'USD',
          isActive: true,
        },
      });
    }

    const walletId = wallet.id;
    const walletBalance = wallet.balance ?? 0;

    const result = await prisma.$transaction(async (tx) => {
      const currentWallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!currentWallet) {
        throw new Error('Wallet not found');
      }

      // For AdminStock: use stock_transfer, for regular members: use product_purchase
      const positivePV = await tx.walletTransaction.aggregate({
        where: {
          walletId,
          referenceType: pvSourceType,
          amount: { gt: 0 },
        },
        _sum: {
          amount: true,
        },
      });

      // Deductions: rank_topup and maintenance_payment (both use the same source type)
      const deductionPV = await tx.walletTransaction.aggregate({
        where: {
          walletId,
          referenceType: { in: ['maintenance_payment', 'rank_topup'] },
          amount: { lt: 0 },
        },
        _sum: {
          amount: true,
        },
      });

      const availablePV =
        Number(positivePV._sum.amount || 0) + Number(deductionPV._sum.amount || 0);

      if (availablePV <= 0) {
        throw new Error(isAdminStock ? 'Insufficient PV from Stock' : 'Insufficient PV from Product Purchases');
      }

      const amountToUse = requestedAmount !== undefined
        ? Number(requestedAmount)
        : availablePV;

      if (!Number.isFinite(amountToUse) || amountToUse <= 0) {
        throw new Error('Invalid PV amount');
      }

      if (amountToUse > availablePV) {
        throw new Error(isAdminStock ? 'Requested PV exceeds available stock PV' : 'Requested PV exceeds available product PV');
      }

      // Get target member (the one receiving the PV)
      const targetMember = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { pv: true, rank: true, id: true },
      });
      if (!targetMember) {
        throw new Error('Target member not found');
      }

      // Get or create wallet for target member
      let targetWallet = await tx.wallet.findUnique({
        where: { userId: targetUserId },
      });

      if (!targetWallet) {
        targetWallet = await tx.wallet.create({
          data: {
            userId: targetUserId,
            balance: 0,
            currency: 'USD',
            isActive: true,
          },
        });
      }

      // Only update PV/Rank directly if member is topping up for themselves
      // When Admin Stock tops up for another member, PV goes to PV/Product only
      // The member must use it themselves to convert to PV/Rank
      const currentRank = (targetMember.rank || 'Member') as Rank;
      let updatedPV = targetMember.pv || 0;
      let rankCheck = { shouldUpdate: false, newRank: currentRank };

      if (targetUserId === user.id) {
        // Member topping up for themselves - update PV/Rank directly
        // NO credit transaction needed - PV is already in their Product PV from purchases
        // We'll deduct it via debit rank_topup transactions below
        const oldPV = targetMember.pv || 0;
        updatedPV = oldPV + amountToUse;
        rankCheck = shouldUpdateRank(currentRank, updatedPV);
        const oldRank = currentRank;

        await tx.user.update({
          where: { id: targetUserId },
          data: {
            pv: updatedPV,
            pvDate: new Date(),
            rankOnlyNoPv: false,
            ...(rankCheck.shouldUpdate ? { rank: rankCheck.newRank as any } : {}),
          },
        });

        // Store PV change data for after transaction (to update sponsor waiting PV)
        (tx as any)._pvChangeData = {
          memberId: targetUserId,
          oldPV,
          newPV: updatedPV,
          oldRank,
          newRank: rankCheck.shouldUpdate ? rankCheck.newRank : oldRank,
          rankUpgraded: rankCheck.shouldUpdate && rankCheck.newRank !== oldRank
        };
      } else {
        // Admin Stock topping up for another member - update PV/Rank directly and auto-upgrade rank
        const oldPV = targetMember.pv || 0;
        updatedPV = oldPV + amountToUse;
        rankCheck = shouldUpdateRank(currentRank, updatedPV);
        const oldRank = currentRank;

        // Update member's PV/Rank and rank if eligible
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            pv: updatedPV,
            pvDate: new Date(),
            rankOnlyNoPv: false,
            ...(rankCheck.shouldUpdate ? { rank: rankCheck.newRank as any } : {}),
          },
        });

        // Store PV change data for after transaction (to update sponsor waiting PV and Binary Bonus)
        (tx as any)._pvChangeData = {
          memberId: targetUserId,
          oldPV,
          newPV: updatedPV,
          oldRank,
          newRank: rankCheck.shouldUpdate ? rankCheck.newRank : oldRank,
          rankUpgraded: rankCheck.shouldUpdate && rankCheck.newRank !== oldRank
        };

        // Also create a transaction record for history tracking
        await tx.walletTransaction.create({
          data: {
            walletId: targetWallet.id,
            type: 'credit',
            amount: amountToUse,
            balanceBefore: targetWallet.balance ?? 0,
            balanceAfter: targetWallet.balance ?? 0, // Wallet balance doesn't change, only PV/Rank changes
            description: `Rank Top-Up: Admin Stock (${user.memberId || user.id}) added PV${rankCheck.shouldUpdate ? ` and upgraded to ${rankCheck.newRank}` : ''}`,
            referenceId: null,
            referenceType: 'rank_topup', // Store as rank_topup to show in history
            status: 'completed',
            createdAt: new Date(),
          },
        });
      }

      // Deduct PV from the actor's transactions (product_purchase for regular members, stock_transfer for AdminStock)
      const sourceTransactions = await tx.walletTransaction.findMany({
        where: {
          walletId,
          referenceType: pvSourceType,
          amount: { gt: 0 },
        },
        select: {
          id: true,
          amount: true,
          referenceId: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      let remainingToDeduct = amountToUse;
      const transactionsToCreate: Array<any> = [];

      for (const sourceTx of sourceTransactions) {
        if (remainingToDeduct <= 0) break;
        const txAmount = Number(sourceTx.amount);
        const deductAmount = Math.min(remainingToDeduct, txAmount);
        
        // Create debit transaction for member's PV/Product deduction
        // Note: AdminStock PV/Stock was already deducted when member received PV/Product at order creation
        // No need to deduct again here
        const sourceDescription = isAdminStock 
          ? `Stock Transfer (${sourceTx.referenceId || 'N/A'})`
          : `Product Purchase (Order ${sourceTx.referenceId || 'N/A'})`;
        transactionsToCreate.push({
          walletId,
          type: 'debit',
          amount: -deductAmount,
          balanceBefore: currentWallet.balance ?? walletBalance,
          balanceAfter: currentWallet.balance ?? walletBalance,
          description: targetUserId === user.id
            ? `Rank Top-Up: Deducted from ${sourceDescription}`
            : `Rank Top-Up for Member: Deducted from ${sourceDescription}`,
          referenceId: targetUserId !== user.id ? targetUserId : null,
          referenceType: 'rank_topup',
          status: 'completed',
          createdAt: new Date(),
        });

        remainingToDeduct -= deductAmount;
      }

      if (remainingToDeduct > 0) {
        throw new Error('Insufficient granular PV to complete rank top-up');
      }

      if (transactionsToCreate.length > 0) {
        await tx.walletTransaction.createMany({
          data: transactionsToCreate,
        });
      }

      return {
        amountUsed: amountToUse,
        availablePV,
        updatedPV: updatedPV, // Return updated PV for both self-topup and AdminStock topup
        rankCheck,
        newRank: rankCheck.shouldUpdate ? rankCheck.newRank : currentRank,
        targetUserId,
        isAdminStockTopup: targetUserId !== user.id,
        pvChangeData: (tx as any)._pvChangeData || null
      };
    });

    // CRITICAL: After transaction completes, handle PV change and Binary Bonus
    // This ensures sponsor receives Binary Bonus when member upgrades rank using PV/Product
    if (result.pvChangeData) {
      const { memberId, oldPV, newPV, oldRank, newRank, rankUpgraded } = result.pvChangeData;
      
      // 1. Add PV to sponsor's waiting PV for binary bonus calculations
      try {
        const { PVMatchingService } = await import('@/services/pv-matching-service');
        await PVMatchingService.handlePVChange(memberId, oldPV, newPV);
        logger.info('PV added to sponsor\'s waiting PV after rank top-up using PV/Product', {
          memberId,
          oldPV,
          newPV,
          pvDifference: newPV - oldPV
        });
      } catch (pvMatchingError: any) {
        logger.error('Failed to update sponsor waiting PV after rank top-up', {
          error: pvMatchingError.message,
          memberId,
          pvDifference: newPV - oldPV
        });
      }

      // 2. Create Binary Bonus for sponsor when member receives PV (even without rank upgrade)
      // Binary Bonus should be paid based on PV increment, not just rank upgrade
      if (newPV > oldPV) {
        try {
          // Get member's placement parent (binary tree parent) and sponsor (direct referrer)
          const member = await prisma.user.findUnique({
            where: { id: memberId },
            select: { 
              id: true,
              placementParentId: true,
              sponsorId: true,
              position: true,
              memberId: true,
              fullName: true,
              rank: true
            }
          });

          // Use placementParentId for binary tree structure (this is the parent in the binary tree)
          const parentId = member?.placementParentId;
          
          if (parentId) {
            const { getCommissionRateByRank } = await import('@/lib/referral-tracking');
            
            // Get parent's (placement parent) rank
            const parentUser = await prisma.user.findUnique({
              where: { id: parentId },
              select: { rank: true, companyId: true, memberId: true, fullName: true }
            });

            const parentRank = parentUser?.rank || null;
            const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
            
            // Check if member has valid rank (Bronze+) and parent has valid rank
            const memberCurrentRank = member.rank || newRank || oldRank;
            const isMemberRankEligible = memberCurrentRank && validRanks.includes(memberCurrentRank.trim());
            const isParentValidRank = parentRank && validRanks.includes(parentRank.trim());
            
            if (isMemberRankEligible && isParentValidRank) {
              // Use incremental PV (newPV - oldPV) for Binary Bonus calculation
              const pvIncrement = newPV - oldPV;
              const commissionRate = getCommissionRateByRank(parentRank.trim());
              
              if (pvIncrement > 0 && commissionRate > 0) {
                const commissionAmount = Math.round((pvIncrement * commissionRate) * 100) / 100;
                
                // Check if Binary Bonus already exists for this member's PV addition (prevent duplicates)
                // Check for same member, within last 5 minutes
                const recentCommissions = await prisma.commission.findMany({
                  where: {
                    userId: parentId,
                    type: 'Binary Bonus',
                    description: { contains: member.memberId || member.id },
                    date: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
                  }
                });

                // Filter to check if there's already a commission for this PV addition
                const duplicateExists = recentCommissions.some(comm => {
                  const desc = comm.description || '';
                  return desc.includes(`+${pvIncrement} PV`) || 
                         (rankUpgraded && desc.includes(`upgraded to ${newRank}`));
                });

                if (!duplicateExists) {
                  // Create Binary Bonus commission
                  const rankUpgradeText = rankUpgraded && newRank !== oldRank 
                    ? ` upgraded to ${newRank.trim()}`
                    : '';
                  const commission = await prisma.commission.create({
                    data: {
                      userId: parentId,
                      amount: commissionAmount,
                      type: 'Binary Bonus',
                      status: 'Paid',
                      date: new Date(),
                      description: `Binary Bonus: ${member.fullName || member.memberId} (${memberCurrentRank.trim()}, +${pvIncrement} PV)${rankUpgradeText} via AdminStock Top-Up - ${pvIncrement} PV × ${(commissionRate * 100).toFixed(1)}%`,
                      companyId: parentUser?.companyId || null
                    }
                  });

                  // Credit wallet
                  try {
                    let wallet = await prisma.wallet.findUnique({
                      where: { userId: parentId }
                    });

                    if (!wallet) {
                      wallet = await prisma.wallet.create({
                        data: {
                          userId: parentId,
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
                        where: { id: parentId },
                        data: {
                          eCashBalance: {
                            increment: commissionAmount
                          } as any
                        }
                      });
                      logger.info('User eCashBalance updated for Binary Bonus', {
                        parentId,
                        commissionAmount
                      });
                    } catch (eCashError: any) {
                      // Log but don't fail if eCashBalance field doesn't exist
                      logger.debug('Could not update eCashBalance field (may not exist)', {
                        error: eCashError.message,
                        parentId
                      });
                    }

                    logger.info('Binary Bonus commission paid for AdminStock top-up', {
                      commissionId: commission.id,
                      parentId,
                      parentMemberId: parentUser?.memberId,
                      memberId: member.memberId,
                      oldRank,
                      newRank,
                      oldPV,
                      newPV,
                      pvIncrement,
                      commissionRate,
                      commissionAmount,
                      rankUpgraded
                    });
                  } catch (walletError: any) {
                    logger.error('Failed to credit wallet for Binary Bonus (AdminStock top-up)', {
                      error: walletError.message,
                      parentId,
                      commissionAmount
                    });
                  }
                } else {
                  logger.info('Binary Bonus already exists for this PV addition, skipping duplicate', {
                    parentId,
                    memberId: member.memberId,
                    pvIncrement
                  });
                }
              }
            }
            // Trigger G2 Binary Bonus for grandparent (President/Manager+) when this member (as G2) received PV via AdminStock top-up
            try {
              const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
              await autoCalculateG2BinaryBonus(parentId, memberId);
              logger.info('G2 Binary Bonus auto-calculated after AdminStock top-up', { memberId, parentId });
            } catch (g2Error: any) {
              logger.warn('Failed to auto-calculate G2 Binary Bonus after AdminStock top-up', { error: g2Error?.message, memberId });
            }
          }
        } catch (binaryBonusError: any) {
          // Log but don't fail if Binary Bonus creation fails
          logger.error('Failed to create Binary Bonus for rank upgrade via PV/Product', {
            error: binaryBonusError.message,
            memberId,
            oldRank,
            newRank
          });
        }
      }
    }

    try {
      // Notify the target member (the one who received the PV)
      await prisma.notification.create({
        data: {
          memberId: targetUserId,
          type: 'in_app',
          category: 'system',
          title: targetUserId === user.id ? 'Rank Top-Up Completed' : 'Rank Top-Up Completed',
          body: targetUserId === user.id
            ? `Converted ${result.amountUsed} PV from product purchases into PV/Rank${result.rankCheck.shouldUpdate ? ` and upgraded to ${result.rankCheck.newRank}` : ''}.`
            : `Admin Stock added ${result.amountUsed} PV to your PV/Rank${result.rankCheck.shouldUpdate ? ` and you have been upgraded to ${result.rankCheck.newRank}` : ''}.`,
          data: {
            amount: result.amountUsed,
            newPV: result.updatedPV,
            newRank: result.newRank,
            addedToProductPV: false, // Now goes directly to PV/Rank
            link: '/ecash' // Navigate to E-Cash page
          },
          priority: 'medium',
        },
      });
    } catch (notifyErr) {
      console.error('Rank top-up notification failed', notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: targetUserId === user.id
        ? `Rank top-up completed using ${result.amountUsed} PV from product purchases${result.rankCheck.shouldUpdate ? ` and upgraded to ${result.rankCheck.newRank}` : ''}.`
        : `Successfully added ${result.amountUsed} PV to member's PV/Rank${result.rankCheck.shouldUpdate ? ` and member has been upgraded to ${result.rankCheck.newRank}` : ''}.`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message || 'Unexpected error';
    if (
      ['Insufficient PV from Product Purchases', 'Requested PV exceeds available product PV'].includes(message)
    ) {
      return NextResponse.json({ error: message, message }, { status: 400 });
    }

    logger.error('Rank top-up error', { error: message }, request);
    return NextResponse.json(
      { error: 'Failed to process rank top-up', message },
      { status: 500 }
    );
  }
}
