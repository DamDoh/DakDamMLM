/**
 * Daily Match Trigger Service
 *
 * LOGIC:
 * 1. Waiting PV is the SOURCE OF TRUTH for matching
 * 2. When new member joins → ADD their rank PV to sponsor's waiting leg
 * 3. Matched PV = min(left waiting, right waiting)
 * 4. Daily Match Commission = Matched PV × 8% (no fixed PV blocks, no rank limit on matching)
 * 5. After match: Left -= Matched PV, Right -= Matched PV
 * 6. Rank used ONLY for: eligibility (Bronze+), daily payout cap, matching bonus %
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { PVMatchingService } from './pv-matching-service';

// Daily Match: max payout per day by rank ($). No fixed PV blocks; commission = matched PV × 8%.
const BONUS_CONFIG: Record<string, { dailyCapAmount: number; label: string }> = {
  Bronze: { dailyCapAmount: 8, label: 'Daily Match' },
  Silver: { dailyCapAmount: 80, label: 'Daily Match' },
  Gold: { dailyCapAmount: 320, label: 'Daily Match' },
  Diamond: { dailyCapAmount: 640, label: 'Daily Match' },
  Manager: { dailyCapAmount: 800, label: 'Daily Match' },
  Director: { dailyCapAmount: 928, label: 'Daily Match' },
  President: { dailyCapAmount: 1120, label: 'Daily Match' },
  'Double President': { dailyCapAmount: 1600, label: 'Daily Match' },
};

const DAILY_MATCH_RATE = 0.08;

/**
 * Process daily match directly without complex eligibility checks
 * Returns result with reason if skipped
 */
export async function processDirectDailyMatch(userId: string): Promise<{
  success: boolean;
  reason?: string;
  matchedPV?: number;
  commission?: number;
  leftAfterMatch?: number;
  rightAfterMatch?: number;
}> {
  try {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        rank: true,
        isAdmin: true,
        email: true,
        active: true,
        deleted: true,
        memberId: true
      }
    });

    if (!user || !user.active || user.deleted) {
      return { success: false, reason: 'User not found or inactive' };
    }

    // Check if superadmin (skip for superadmin)
    const { isSuperAdminSync } = await import('@/lib/superadmin-helper');
    if (isSuperAdminSync(user)) {
      return { success: false, reason: 'Superadmin cannot earn Daily Match' };
    }

    // Get waiting PV
    const waitingPV = await PVMatchingService.getWaitingPV(userId);
    const leftWaitingPV = waitingPV.leftWaitingPV;
    const rightWaitingPV = waitingPV.rightWaitingPV;

    if (leftWaitingPV <= 0 || rightWaitingPV <= 0) {
      return { success: false, reason: 'No matchable PV (need both legs > 0)' };
    }

    // Calculate matched PV
    const matchedPV = Math.min(leftWaitingPV, rightWaitingPV);

    // Check if already paid today
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCommissions = await prisma.commission.findMany({
      where: {
        userId: userId,
        type: 'Daily Match',
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] }
      },
      select: { id: true, amount: true }
    });

    const previousAmount = existingCommissions.reduce((sum, comm) => sum + (Number(comm.amount) || 0), 0);

    const rule = BONUS_CONFIG[user.rank];
    if (!rule) {
      return { success: false, reason: 'Rank not eligible for Daily Match' };
    }

    const dailyCapAmount = rule.dailyCapAmount;

    // ==========================================================================
    // CRITICAL: ALWAYS UPDATE WAITING PV FIRST (even if daily cap is reached)
    // ==========================================================================

    let leftAfterMatch: number;
    let rightAfterMatch: number;

    if (leftWaitingPV > rightWaitingPV) {
      leftAfterMatch = leftWaitingPV - rightWaitingPV;
      rightAfterMatch = 0;
    } else if (rightWaitingPV > leftWaitingPV) {
      leftAfterMatch = 0;
      rightAfterMatch = rightWaitingPV - leftWaitingPV;
    } else {
      leftAfterMatch = 0;
      rightAfterMatch = 0;
    }

    await PVMatchingService.updateWaitingPV(userId, leftAfterMatch, rightAfterMatch);

    logger.info('✅ Waiting PV updated (pairing completed)', {
      userId,
      leftWaitingPV: leftAfterMatch,
      rightWaitingPV: rightAfterMatch,
      matchedPV,
      note: 'Waiting PV updated even if daily cap reached - pairing continues normally'
    });

    // ==========================================================================
    // COMMISSION: Matched PV × 8%. Cap = daily max $ (rank-based).
    // ==========================================================================

    const rawCommission = Math.round(matchedPV * DAILY_MATCH_RATE * 100) / 100;
    const remainingCap = Math.max(0, dailyCapAmount - previousAmount);
    const actualPayout = Math.round(Math.min(rawCommission, remainingCap) * 100) / 100;
    const dailyCapReached = previousAmount >= dailyCapAmount;

    const todayKey = today.toISOString().split('T')[0];

    await PVMatchingService.recordMatchTransaction(userId, {
      leftPVUsed: matchedPV,
      rightPVUsed: matchedPV,
      matchedPV,
      leftWaitingAfter: leftAfterMatch,
      rightWaitingAfter: rightAfterMatch,
      commissionRate: DAILY_MATCH_RATE,
      commissionEarned: actualPayout,
      triggerType: 'auto',
      memberRank: user.rank,
      dailyCapMatches: dailyCapAmount,
      matchesUsed: actualPayout > 0 ? 1 : 0
    });

    if (dailyCapReached || actualPayout <= 0) {
      logger.info('Daily cap reached or no payout - pairing completed but no commission paid', {
        userId,
        rank: user.rank,
        previousAmount,
        dailyCapAmount,
        matchedPV,
        rawCommission,
        actualPayout,
        leftAfterMatch,
        rightAfterMatch
      });
      return {
        success: true,
        matchedPV,
        commission: 0,
        leftAfterMatch,
        rightAfterMatch,
        reason: dailyCapReached
          ? `Pairing completed but daily cap reached: $${previousAmount.toFixed(2)} / $${dailyCapAmount}`
          : `Pairing completed; no commission (cap exhausted)`
      };
    }

    await prisma.wallet.upsert({
      where: { userId: userId },
      create: { userId: userId, balance: 0, currency: 'USD' },
      update: {}
    });

    const { WalletServiceEnhanced } = await import('./wallet-service-enhanced');
    // Unique per match so multiple matches per day each get credited (renew top-ups)
    const referenceId = `${userId}:daily_match:${user.rank}:${todayKey}:${matchedPV}:${Date.now()}`;

    await WalletServiceEnhanced.creditWallet(userId, actualPayout, 'Daily Match', referenceId, 'daily_match');

    await prisma.commission.create({
      data: {
        userId: userId,
        amount: actualPayout,
        type: 'Daily Match',
        status: 'Paid',
        date: new Date(),
        description: `Daily Match Bonus - ${matchedPV} PV matched at 8% = $${actualPayout.toFixed(2)}`
      }
    });

    logger.info('Direct daily match processed', {
      userId,
      leftBefore: leftWaitingPV,
      rightBefore: rightWaitingPV,
      matchedPV,
      rawCommission,
      actualPayout,
      leftAfter: leftAfterMatch,
      rightAfter: rightAfterMatch
    });

    try {
      await prisma.notification.create({
        data: {
          memberId: userId,
          type: 'in_app',
          category: 'commission',
          title: `Daily Match Bonus: $${actualPayout.toFixed(2)}`,
          body: `You earned $${actualPayout.toFixed(2)} in Daily Match Bonus. ${matchedPV.toLocaleString()} PV matched at 8%.`,
          data: {
            commissionType: 'Daily Match',
            amount: actualPayout,
            matchedPV,
            link: '/commission'
          },
          priority: 'high',
          isRead: false,
          isSent: false
        }
      });
    } catch (notifError: any) {
      logger.warn('Failed to create Daily Match notification', {
        error: (notifError as Error)?.message,
        userId
      });
    }

    // ==========================================================================
    // TRIGGER MATCHING BONUS FOR ALL ELIGIBLE SPONSORS (G1, G2, G3)
    // Cascades up the chain to trigger matching bonus for all eligible sponsors
    // Formula: Matching Bonus = Daily Match Amount × Sponsor's Rate for Generation
    // Example: $8 × 60% (G1) = $4.80, $8 × 10% (G2) = $0.80, $8 × 10% (G3) = $0.80
    // ==========================================================================
    try {
      await triggerMatchingBonusCascade(userId, actualPayout);
    } catch (matchingError) {
      logger.error('Error triggering Matching Bonus cascade', {
        userId,
        error: matchingError instanceof Error ? matchingError.message : 'Unknown'
      });
      // Don't fail the Daily Match if Matching Bonus fails
    }

    return {
      success: true,
      matchedPV,
      commission: actualPayout,
      leftAfterMatch,
      rightAfterMatch
    };

  } catch (error) {
    logger.error('Error in processDirectDailyMatch', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown'
    });
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if a member is eligible for Daily Match and auto-trigger if they are
 * Uses waiting PV as the source of truth
 */
export async function checkAndTriggerDailyMatch(parentId: string): Promise<void> {
  try {
    // Get parent member
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        rank: true,
        children: true,
        isAdmin: true,
        email: true,
        active: true,
        deleted: true,
        memberId: true
      }
    });

    if (!parent || !parent.active || parent.deleted) {
      return;
    }

    // Check if superadmin (cannot earn Daily Match)
    const { isSuperAdminSync, canEarnCommissions } = await import('@/lib/superadmin-helper');
    if (isSuperAdminSync(parent)) {
      logger.debug('Superadmin cannot earn Daily Match', { parentId });
      return;
    }

    // Check if parent can earn commissions (has downlines)
    if (!(await canEarnCommissions(parent.id))) {
      logger.debug('Member has no downlines', { parentId });
      return;
    }

    // Note: Daily Match does NOT require maintenance topup payment
    // Daily Match is based solely on PV matching from binary tree structure
    
    // Check rank eligibility
    const rule = BONUS_CONFIG[parent.rank];
    if (!rule) {
      logger.debug('Rank not eligible for Daily Match', { parentId, rank: parent.rank });
      return;
    }

    // Verify both left and right G1 children exist (no rank requirement - based on PV waiting only)
    // Matching Bonus is calculated from paired PV, not from children's rank
    const [leftChild, rightChild] = await Promise.all([
      prisma.user.findFirst({
        where: { 
          placementParentId: parent.id, 
          position: 'left', 
          deleted: false
        },
        select: { id: true, rank: true }
      }),
      prisma.user.findFirst({
        where: { 
          placementParentId: parent.id, 
          position: 'right', 
          deleted: false
        },
        select: { id: true, rank: true }
      })
    ]);

    if (!leftChild || !rightChild) {
      logger.debug('Missing left or right child', { 
        parentId, 
        hasLeft: !!leftChild, 
        hasRight: !!rightChild 
      });
      return;
    }

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const waitingPV = await PVMatchingService.getWaitingPV(parent.id);
    const leftWaitingPV = waitingPV.leftWaitingPV;
    const rightWaitingPV = waitingPV.rightWaitingPV;
    const matchedPV = Math.min(leftWaitingPV, rightWaitingPV);

    if (matchedPV <= 0) {
      logger.debug('No matching PV', { parentId, leftWaitingPV, rightWaitingPV });
      return;
    }

    let leftAfterMatch: number;
    let rightAfterMatch: number;
    if (leftWaitingPV > rightWaitingPV) {
      leftAfterMatch = leftWaitingPV - rightWaitingPV;
      rightAfterMatch = 0;
    } else if (rightWaitingPV > leftWaitingPV) {
      leftAfterMatch = 0;
      rightAfterMatch = rightWaitingPV - leftWaitingPV;
    } else {
      leftAfterMatch = 0;
      rightAfterMatch = 0;
    }

    await PVMatchingService.updateWaitingPV(parent.id, leftAfterMatch, rightAfterMatch);
    logger.info('✅ Waiting PV updated (pairing completed)', {
      parentId,
      leftWaitingPV: leftAfterMatch,
      rightWaitingPV: rightAfterMatch,
      matchedPV,
      note: 'Waiting PV updated even if daily cap reached - pairing continues normally'
    });

    const existingCommissions = await prisma.commission.findMany({
      where: {
        userId: parentId,
        type: 'Daily Match',
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] }
      },
      select: { id: true, amount: true }
    });
    const previousAmount = existingCommissions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const dailyCapAmount = rule.dailyCapAmount;
    const rawCommission = Math.round(matchedPV * DAILY_MATCH_RATE * 100) / 100;
    const remainingCap = Math.max(0, dailyCapAmount - previousAmount);
    const actualPayout = Math.round(Math.min(rawCommission, remainingCap) * 100) / 100;
    const dailyCapReached = previousAmount >= dailyCapAmount;

    const todayKey = today.toISOString().split('T')[0];
    await PVMatchingService.recordMatchTransaction(parent.id, {
      leftPVUsed: matchedPV,
      rightPVUsed: matchedPV,
      matchedPV,
      leftWaitingAfter: leftAfterMatch,
      rightWaitingAfter: rightAfterMatch,
      commissionRate: DAILY_MATCH_RATE,
      commissionEarned: actualPayout,
      triggerType: 'auto',
      memberRank: parent.rank,
      dailyCapMatches: dailyCapAmount,
      matchesUsed: actualPayout > 0 ? 1 : 0
    });

    if (dailyCapReached || actualPayout <= 0) {
      logger.info('Daily cap reached or no payout - pairing completed but no commission paid', {
        parentId,
        rank: parent.rank,
        previousAmount,
        dailyCapAmount,
        matchedPV,
        rawCommission,
        actualPayout,
        leftAfterMatch,
        rightAfterMatch
      });
      return;
    }

    await prisma.wallet.upsert({
      where: { userId: parentId },
      create: { userId: parentId, balance: 0, currency: 'USD' },
      update: {}
    });

    const { WalletServiceEnhanced } = await import('./wallet-service-enhanced');
    // Unique per match so renew top-ups each get their own Daily Match + Matching Bonus (was same per day, blocking 2nd+ matches)
    const referenceId = `${parentId}:daily_match:${parent.rank}:${todayKey}:${matchedPV}:${Date.now()}`;
    await WalletServiceEnhanced.creditWallet(parentId, actualPayout, rule.label, referenceId, 'daily_match');

    const commission = await prisma.commission.create({
      data: {
        userId: parentId,
        amount: actualPayout,
        type: rule.label,
        status: 'Paid',
        date: new Date(),
        description: `Daily Match Bonus - ${matchedPV} PV matched at 8% = $${actualPayout.toFixed(2)}`
      }
    });

    try {
      await prisma.notification.create({
        data: {
          memberId: parentId,
          type: 'in_app',
          category: 'commission',
          title: `Daily Match Bonus: $${actualPayout.toFixed(2)}`,
          body: `You earned $${actualPayout.toFixed(2)} in Daily Match Bonus. ${matchedPV.toLocaleString()} PV matched at 8%.`,
          data: {
            commissionIds: [commission.id],
            commissionType: rule.label,
            amount: actualPayout,
            matchedPV,
            link: '/commission'
          },
          priority: 'high',
          isRead: false,
          isSent: false
        }
      });
    } catch (notifError: any) {
      logger.warn('Failed to create Daily Match notification', {
        error: (notifError as Error)?.message,
        userId: parentId
      });
    }

    logger.info('Auto-created Daily Match', {
      parentId,
      amount: actualPayout,
      matchedPV,
      commissionId: commission.id,
      leftAfterMatch,
      rightAfterMatch
    });

    // ==========================================================================
    // TRIGGER MATCHING BONUS FOR ALL ELIGIBLE SPONSORS (G1, G2, G3)
    // Cascades up the chain to trigger matching bonus for all eligible sponsors
    // Formula: Matching Bonus = Daily Match Amount × Sponsor's Rate for Generation
    // Example: $8 × 60% (G1) = $4.80, $8 × 10% (G2) = $0.80, $8 × 10% (G3) = $0.80
    // ==========================================================================
    try {
      await triggerMatchingBonusCascade(parentId, actualPayout);
    } catch (matchingError) {
      logger.error('Error triggering Matching Bonus cascade', {
        parentId,
        error: matchingError instanceof Error ? matchingError.message : 'Unknown'
      });
      // Don't fail the Daily Match if Matching Bonus fails
    }

  } catch (error) {
    logger.error('Error in checkAndTriggerDailyMatch', {
      parentId,
      error: error instanceof Error ? error.message : 'Unknown'
    });
  }
}

/**
 * TRIGGER MATCHING BONUS CASCADE: Trigger matching bonus for all eligible sponsors (G1, G2, G3)
 * When a downline earns Daily Match, this cascades up the chain to trigger matching bonus
 * for all eligible sponsors based on their rank rates for each generation
 */
export async function triggerMatchingBonusCascade(
  downlineUserId: string,
  dailyMatchAmount: number
): Promise<void> {
  try {
    const { CommissionCalculationEngineEnhanced } = await import('./commission-calculation-engine');
    const { isSuperAdmin, canEarnCommissions } = await import('@/lib/superadmin-helper');
    const { hasMaintenancePaid } = await import('@/lib/maintenance');
    const { WalletServiceEnhanced } = await import('./wallet-service-enhanced');

    // Get the downline member info
    const downlineMember = await prisma.user.findUnique({
      where: { id: downlineUserId },
      select: {
        id: true,
        memberId: true,
        sponsorId: true,
        placementParentId: true,
        position: true
      }
    });

    if (!downlineMember) {
      logger.warn('Downline member not found for matching bonus cascade', { downlineUserId });
      return;
    }

    // Walk up the chain for Matching Bonus: G1, G2, G3
    // CRITICAL: Use placementParentId FIRST for G1 when downline earned Daily Match - the binary parent
    // is whose legs were matched, so they receive Matching Bonus. Fallback to sponsorId (referral).
    const sponsors: Array<{ id: string; memberId: string; rank: string; generation: number; leg: string; g1Leg?: string; g2Position?: string; downlinePosition?: string }> = [];
    
    // G1: Binary parent (placement) first so ADM002 gets bonus when ADM004 earns Daily Match
    const g1SponsorId = downlineMember.placementParentId || downlineMember.sponsorId;
    if (g1SponsorId) {
      const g1Sponsor = await prisma.user.findUnique({
        where: { id: g1SponsorId },
        select: {
          id: true,
          memberId: true,
          rank: true,
          active: true,
          deleted: true,
          sponsorId: true,
          placementParentId: true,
          position: true
        }
      });

      if (g1Sponsor && g1Sponsor.active && !g1Sponsor.deleted && g1Sponsor.rank) {
        // For G1 matching bonus: use downline's position relative to placement parent for leg labeling
        const g1LegForG1 = downlineMember.position?.toLowerCase() === 'right' ? 'right' : 'left';
        sponsors.push({
          id: g1Sponsor.id,
          memberId: g1Sponsor.memberId,
          rank: g1Sponsor.rank,
          generation: 1,
          leg: g1LegForG1
        });

        // G2: Binary upline first (placement), then referral
        const g2SponsorId = g1Sponsor.placementParentId || g1Sponsor.sponsorId;
        if (g2SponsorId) {
          const g2Sponsor = await prisma.user.findUnique({
            where: { id: g2SponsorId },
            select: {
              id: true,
              memberId: true,
              rank: true,
              active: true,
              deleted: true,
              sponsorId: true,
              placementParentId: true
            }
          });

          if (g2Sponsor && g2Sponsor.active && !g2Sponsor.deleted && g2Sponsor.rank) {
            const g1Leg = g1Sponsor.position?.toLowerCase() === 'right' ? 'right' : 'left';
            const downlinePosition = downlineMember.position?.toLowerCase() === 'right' ? 'right' : 'left';
            sponsors.push({
              id: g2Sponsor.id,
              memberId: g2Sponsor.memberId,
              rank: g2Sponsor.rank,
              generation: 2,
              leg: g1Leg,
              g1Leg: g1Leg,
              downlinePosition: downlinePosition
            });

            // G3: Binary upline first (placement), then referral
            const g3SponsorId = g2Sponsor.placementParentId || g2Sponsor.sponsorId;
            if (g3SponsorId) {
              const g3Sponsor = await prisma.user.findUnique({
                where: { id: g3SponsorId },
                select: {
                  id: true,
                  memberId: true,
                  rank: true,
                  active: true,
                  deleted: true
                }
              });

              if (g3Sponsor && g3Sponsor.active && !g3Sponsor.deleted && g3Sponsor.rank) {
                const g1Leg2 = g1Sponsor.position?.toLowerCase() === 'right' ? 'right' : 'left';
                const g2Position = g1Leg2;
                const g3Position = downlineMember.position?.toLowerCase() === 'right' ? 'right' : 'left';
                sponsors.push({
                  id: g3Sponsor.id,
                  memberId: g3Sponsor.memberId,
                  rank: g3Sponsor.rank,
                  generation: 3,
                  leg: g1Leg2,
                  g1Leg: g1Leg2,
                  g2Position: g2Position,
                  downlinePosition: g3Position
                });
              }
            }
          }
        }
      }
    }

    // Group sponsors by sponsor ID, generation, and leg
    // Key: sponsorId:generation:leg
    const bonusMap = new Map<string, {
      sponsor: typeof sponsors[0];
      totalAmount: number;
      dailyMatchTotal: number;
      downlineIds: string[];
    }>();

    // Process each sponsor and accumulate by generation and leg
    for (const sponsor of sponsors) {
      try {
        // Skip superadmin UNLESS they are AdminStock (S, M, C, D) - AdminStock are business participants who should earn
        const sponsorUser = await prisma.user.findUnique({
          where: { id: sponsor.id },
          select: { storeOwnerLevel: true }
        });
        const isAdminStock = sponsorUser?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(sponsorUser.storeOwnerLevel);
        if (await isSuperAdmin(sponsor.id) && !isAdminStock) {
          logger.debug('Skipping superadmin for matching bonus', { sponsorId: sponsor.id });
          continue;
        }

        // Check if sponsor can earn commissions (AdminStock always can; others need downlines)
        if (!isAdminStock && !(await canEarnCommissions(sponsor.id))) {
          logger.debug('Sponsor cannot earn commissions', { sponsorId: sponsor.id });
          continue;
        }

        // Check maintenance (required for matching bonus) - AdminStock bypass: they are business participants
        if (!isAdminStock) {
          const maintenancePaid = await hasMaintenancePaid(sponsor.id);
          if (!maintenancePaid) {
            logger.debug('Matching bonus skipped: maintenance not paid', {
              sponsorId: sponsor.id,
              sponsorMemberId: sponsor.memberId,
              generation: sponsor.generation
            });
            continue;
          }
        }

        // Get matching bonus rates for sponsor's rank
        const rankRates = CommissionCalculationEngineEnhanced.getMatchingBonusRate(sponsor.rank);
        
        // Get rate for this generation
        const generationRate = sponsor.generation === 1 ? rankRates.g1 :
                              sponsor.generation === 2 ? rankRates.g2 :
                              rankRates.g3;

        if (generationRate <= 0) {
          logger.debug('Matching bonus rate is 0 for this generation', {
            sponsorId: sponsor.id,
            sponsorRank: sponsor.rank,
            generation: sponsor.generation,
            rates: rankRates
          });
          continue;
        }

        // Calculate matching bonus for this downline
        const matchingBonusAmount = Math.round((dailyMatchAmount * generationRate) * 100) / 100;

        if (matchingBonusAmount > 0) {
          // For G1: separate by leg (left and right)
          // For G2: create separate entry for EACH downline (like G3), labeled with G1 leg and downline position
          // For G3: create separate entry for EACH downline (not grouped by leg)
          let key: string;
          if (sponsor.generation === 1) {
            key = `${sponsor.id}:${sponsor.generation}:${sponsor.leg}`;
          } else if (sponsor.generation === 2) {
            // G2: Each downline gets its own entry, keyed by downline ID
            key = `${sponsor.id}:${sponsor.generation}:${downlineMember.id}`;
          } else {
            // G3: Each downline gets its own entry
            key = `${sponsor.id}:${sponsor.generation}:${downlineMember.id}`;
          }

          if (!bonusMap.has(key)) {
            bonusMap.set(key, {
              sponsor,
              totalAmount: 0,
              dailyMatchTotal: 0,
              downlineIds: []
            });
          }

          const entry = bonusMap.get(key)!;
          entry.totalAmount += matchingBonusAmount;
          entry.dailyMatchTotal += dailyMatchAmount;
          entry.downlineIds.push(downlineMember.memberId);
        }
      } catch (sponsorError) {
        logger.error('Error processing sponsor in matching bonus cascade', {
          sponsorId: sponsor.id,
          generation: sponsor.generation,
          error: sponsorError instanceof Error ? sponsorError.message : 'Unknown'
        });
        // Continue with next sponsor
      }
    }

    // Create commission entries for each grouped bonus
    for (const [key, entry] of bonusMap.entries()) {
      try {
        const { sponsor, totalAmount, dailyMatchTotal, downlineIds } = entry;
        
        // Get rate for this generation
        const rankRates = CommissionCalculationEngineEnhanced.getMatchingBonusRate(sponsor.rank);
        const generationRate = sponsor.generation === 1 ? rankRates.g1 :
                              sponsor.generation === 2 ? rankRates.g2 :
                              rankRates.g3;

        // Create description based on generation and leg
        let description: string;
        if (sponsor.generation === 1) {
          // G1: Separate by leg (left and right)
          const legLabel = sponsor.leg === 'right' ? 'Right' : 'Left';
          description = `Matching Bonus (G1 ${legLabel}): $${dailyMatchTotal.toFixed(2)} × ${(generationRate * 100).toFixed(0)}% = $${totalAmount.toFixed(2)}`;
        } else if (sponsor.generation === 2) {
          // G2: Individual entry per downline, labeled with G1 leg and downline position
          const g1LegLabel = sponsor.g1Leg === 'right' ? 'Right' : 'Left';
          const downlinePosLabel = sponsor.downlinePosition === 'right' ? 'Right' : 'Left';
          const downlineMemberId = downlineIds[0] || 'unknown';
          description = `Matching Bonus (G2 ${g1LegLabel}-${downlinePosLabel}): $${dailyMatchTotal.toFixed(2)} × ${(generationRate * 100).toFixed(0)}% = $${totalAmount.toFixed(2)} (from ${downlineMemberId})`;
        } else {
          // G3: Individual entry per downline, labeled with G1 leg, G2 position, and G3 position
          const g1LegLabel = sponsor.g1Leg === 'right' ? 'Right' : 'Left';
          const g2PosLabel = sponsor.g2Position === 'right' ? 'Right' : 'Left';
          const g3PosLabel = sponsor.downlinePosition === 'right' ? 'Right' : 'Left';
          const downlineMemberId = downlineIds[0] || 'unknown';
          description = `Matching Bonus (G3 ${g1LegLabel}-${g2PosLabel}-${g3PosLabel}): $${dailyMatchTotal.toFixed(2)} × ${(generationRate * 100).toFixed(0)}% = $${totalAmount.toFixed(2)} (from ${downlineMemberId})`;
        }

        // Always create a NEW commission entry for each matching bonus (1 per top-up)
        // User wants separate transactions in E-Cash, not merged totals
        const matchingBonusCommission = await prisma.commission.create({
          data: {
            userId: sponsor.id,
            amount: Math.round(totalAmount * 100) / 100,
            type: 'Matching Bonus',
            description: description,
            status: 'Paid',
            date: new Date(),
            metadata: {
              fromMemberIds: downlineIds,
              dailyMatchTotal: dailyMatchTotal,
              rate: generationRate,
              generation: sponsor.generation,
              leg: (sponsor.generation === 2 || sponsor.generation === 3) ? 'individual' : sponsor.leg
            }
          }
        });

        const walletCreditAmount = Math.round(totalAmount * 100) / 100;

        // Credit sponsor's wallet
        if (walletCreditAmount > 0) {
          await WalletServiceEnhanced.creditWallet(
            sponsor.id,
            Math.round(walletCreditAmount * 100) / 100,
            'Matching Bonus',
            `matching_bonus:${matchingBonusCommission.id}`,
            'commission'
          );
        }

        logger.info('Matching Bonus created for sponsor (grouped by generation and leg)', {
          sponsorId: sponsor.id,
          sponsorMemberId: sponsor.memberId,
          sponsorRank: sponsor.rank,
          generation: sponsor.generation,
          leg: (sponsor.generation === 2 || sponsor.generation === 3) ? 'individual' : sponsor.leg,
          rate: `${(generationRate * 100).toFixed(0)}%`,
          dailyMatchTotal: dailyMatchTotal,
          matchingBonusAmount: totalAmount,
          downlineCount: downlineIds.length,
          downlineIds: downlineIds,
          formula: `$${dailyMatchTotal} × ${(generationRate * 100).toFixed(0)}% (G${sponsor.generation}${(sponsor.generation === 2 || sponsor.generation === 3) ? '' : ` ${sponsor.leg}`}) = $${totalAmount.toFixed(2)}`
        });

        // Send notification to sponsor about Matching Bonus earned
        try {
          await prisma.notification.create({
            data: {
              memberId: sponsor.id,
              type: 'in_app',
              category: 'commission',
              title: `Matching Bonus Earned: $${totalAmount.toFixed(2)}`,
              body: description || `You earned $${totalAmount.toFixed(2)} in Matching Bonus (G${sponsor.generation}${(sponsor.generation === 2 || sponsor.generation === 3) ? '' : ` ${sponsor.leg}`}) from your downline's Daily Match.`,
              data: {
                commissionId: matchingBonusCommission.id,
                commissionType: 'Matching Bonus',
                amount: totalAmount,
                generation: sponsor.generation,
                leg: (sponsor.generation === 2 || sponsor.generation === 3) ? 'individual' : sponsor.leg,
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
            sponsorId: sponsor.id,
            commissionId: matchingBonusCommission.id
          });
        }
      } catch (entryError) {
        logger.error('Error creating grouped matching bonus commission', {
          key,
          error: entryError instanceof Error ? entryError.message : 'Unknown'
        });
      }
    }
  } catch (error) {
    logger.error('Error in triggerMatchingBonusCascade', {
      downlineUserId,
      error: error instanceof Error ? error.message : 'Unknown'
    });
  }
}

/**
 * UPLINE CASCADE: Trigger PV addition for all upline sponsors when a new member joins
 * This adds the new member's rank PV to each upline sponsor's waiting leg
 */
export async function triggerUplineCascade(newMemberId: string): Promise<void> {
  try {
    const newMember = await prisma.user.findUnique({
      where: { id: newMemberId },
      select: { id: true, pv: true, rank: true, placementParentId: true }
    });

    if (!newMember) {
      return;
    }

    const memberPV = Number(newMember.pv) || 0;

    logger.info('Triggering upline cascade for new member', {
      newMemberId,
      memberPV,
      placementParentId: newMember.placementParentId
    });

    // Use the PVMatchingService to add PV to all upline sponsors
    await PVMatchingService.triggerUplineRecalculation(newMemberId, memberPV);

    // AUTO-CALCULATE G2 Binary Bonus: If new member is a G2 downline, trigger G2 bonus for grandparent
    try {
      if (newMember.placementParentId) {
        // Check if new member is a G2 (has a G1 parent who has a grandparent)
        const g1Parent = await prisma.user.findUnique({
          where: { id: newMember.placementParentId },
          select: {
            id: true,
            placementParentId: true,
            memberId: true
          }
        });

        // If G1 has a parent (grandparent), trigger G2 Binary Bonus auto-calculation
        if (g1Parent?.placementParentId) {
          console.log(`🔄 Upline cascade - Auto-calculating G2 Binary Bonus for grandparent:`, {
            newMemberId,
            g1Id: g1Parent.memberId,
            grandparentId: g1Parent.placementParentId
          });

          const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
          await autoCalculateG2BinaryBonus(g1Parent.id, newMemberId);
        }
      }
    } catch (g2Error) {
      // Log but don't fail cascade if G2 calculation fails
      logger.warn('Failed to auto-calculate G2 Binary Bonus in upline cascade', {
        newMemberId,
        error: g2Error instanceof Error ? g2Error.message : 'Unknown error'
      });
    }

  } catch (error) {
    logger.error('Error in triggerUplineCascade', {
      newMemberId,
      error: error instanceof Error ? error.message : 'Unknown'
    });
  }
}

/**
 * Batch process: Check and trigger Daily Match for multiple members
 */
export async function batchCheckDailyMatch(memberIds: string[]): Promise<void> {
  logger.info('Starting batch Daily Match check', { memberCount: memberIds.length });

  for (const memberId of memberIds) {
    try {
      await checkAndTriggerDailyMatch(memberId);
    } catch (error) {
      logger.error('Error processing member in batch', {
        memberId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
  }

  logger.info('Completed batch Daily Match check', { memberCount: memberIds.length });
}

/**
 * Get all eligible members for Daily Match (for batch processing)
 */
export async function getEligibleMembersForDailyMatch(): Promise<string[]> {
  try {
    const eligibleMembers = await prisma.user.findMany({
      where: {
        active: true,
        deleted: false,
        rank: { 
          in: ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'] 
        }
      },
      select: { id: true }
    });

    // Filter to only those with both children
    const membersWithBothChildren: string[] = [];

    for (const member of eligibleMembers) {
      const [leftChild, rightChild] = await Promise.all([
        prisma.user.findFirst({
          where: { placementParentId: member.id, position: 'left', deleted: false },
          select: { id: true }
        }),
        prisma.user.findFirst({
          where: { placementParentId: member.id, position: 'right', deleted: false },
          select: { id: true }
        })
      ]);

      if (leftChild && rightChild) {
        membersWithBothChildren.push(member.id);
      }
    }

    return membersWithBothChildren;
  } catch (error) {
    logger.error('Error getting eligible members', {
      error: error instanceof Error ? error.message : 'Unknown'
    });
    return [];
  }
}
