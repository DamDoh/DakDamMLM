/**
 * POST /api/bonus/daily-match
 *
 * Claim Daily Match bonus for the authenticated member.
 *
 * Logic:
 * 1. Matched PV = min(left waiting, right waiting)
 * 2. Daily Match Commission = Matched PV × 8% (no fixed PV blocks)
 * 3. Rank used only for eligibility and daily payout cap
 * 4. After match: Left -= Matched PV, Right -= Matched PV
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { WalletServiceEnhanced } from '@/services/wallet-service-enhanced';
import { PVMatchingService } from '@/services/pv-matching-service';
import { logger } from '@/lib/logger';

type BonusRule = { dailyCapAmount: number; label: string };

const BONUS_CONFIG: Record<string, BonusRule> = {
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

export async function POST(request: NextRequest) {
  try {
    const authenticatedRequest = await authenticateRequest(request);
    const user = authenticatedRequest.user;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, rank: true, isAdmin: true, email: true, memberId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { isSuperAdminSync, canEarnCommissions } = await import('@/lib/superadmin-helper');
    if (isSuperAdminSync(dbUser)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin cannot earn Daily Match bonus' },
        { status: 200 }
      );
    }

    if (!(await canEarnCommissions(dbUser.id))) {
      return NextResponse.json(
        { success: false, message: 'Member has no downlines - cannot earn Daily Match bonus' },
        { status: 200 }
      );
    }

    const rule = BONUS_CONFIG[dbUser.rank];
    if (!rule) {
      return NextResponse.json({ success: false, message: 'Not eligible (rank)' }, { status: 200 });
    }

    const [leftChild, rightChild] = await Promise.all([
      prisma.user.findFirst({
        where: {
          placementParentId: dbUser.id,
          position: 'left',
          deleted: false,
          rank: { not: 'Member' },
        },
        select: { id: true, rank: true, pv: true },
      }),
      prisma.user.findFirst({
        where: {
          placementParentId: dbUser.id,
          position: 'right',
          deleted: false,
          rank: { not: 'Member' },
        },
        select: { id: true, rank: true, pv: true },
      }),
    ]);

    if (!leftChild || !rightChild) {
      return NextResponse.json({ success: false, message: 'Not eligible (no match)' }, { status: 200 });
    }

    const waitingPV = await PVMatchingService.getWaitingPV(dbUser.id);
    const leftWaitingPV = waitingPV.leftWaitingPV;
    const rightWaitingPV = waitingPV.rightWaitingPV;
    const matchedPV = Math.min(leftWaitingPV, rightWaitingPV);

    if (matchedPV <= 0) {
      return NextResponse.json(
        { success: false, message: 'Not enough PV for matching', leftWaitingPV, rightWaitingPV },
        { status: 200 }
      );
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

    await PVMatchingService.updateWaitingPV(dbUser.id, leftAfterMatch, rightAfterMatch);
    logger.info('Waiting PV updated (pairing completed)', {
      userId: dbUser.id,
      leftAfterMatch,
      rightAfterMatch,
      matchedPV,
    });

    const todayKey = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(todayKey + 'T00:00:00.000Z');
    const endOfDay = new Date(todayKey + 'T23:59:59.999Z');

    const existingCommissions = await prisma.commission.findMany({
      where: {
        userId: dbUser.id,
        type: rule.label,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] },
      },
      select: { id: true, amount: true },
    });
    const previousAmount = existingCommissions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const dailyCapAmount = rule.dailyCapAmount;
    const rawCommission = Math.round(matchedPV * DAILY_MATCH_RATE * 100) / 100;
    const remainingCap = Math.max(0, dailyCapAmount - previousAmount);
    const actualPayout = Math.round(Math.min(rawCommission, remainingCap) * 100) / 100;
    const dailyCapReached = previousAmount >= dailyCapAmount;

    const referenceId = `${dbUser.id}:daily_match:${dbUser.rank}:${todayKey}`;

    await PVMatchingService.recordMatchTransaction(dbUser.id, {
      leftPVUsed: matchedPV,
      rightPVUsed: matchedPV,
      matchedPV,
      leftWaitingAfter: leftAfterMatch,
      rightWaitingAfter: rightAfterMatch,
      commissionRate: DAILY_MATCH_RATE,
      commissionEarned: actualPayout,
      triggerType: 'manual',
      memberRank: dbUser.rank,
      dailyCapMatches: dailyCapAmount,
      matchesUsed: actualPayout > 0 ? 1 : 0,
    });

    if (dailyCapReached || actualPayout <= 0) {
      return NextResponse.json(
        {
          success: true,
          message: `Pairing completed but daily cap reached ($${previousAmount.toFixed(2)} / $${dailyCapAmount}). Waiting PV updated.`,
          pairingCompleted: true,
          commissionPaid: false,
          previousAmount,
          dailyCapAmount,
          matchedPV,
          rawCommission,
          actualPayout: 0,
          waitingPV: { left: leftAfterMatch, right: rightAfterMatch },
        },
        { status: 200 }
      );
    }

    await prisma.wallet.upsert({
      where: { userId: dbUser.id },
      create: { userId: dbUser.id, balance: 0, currency: 'USD' },
      update: {},
      select: { id: true },
    });

    await WalletServiceEnhanced.creditWallet(dbUser.id, actualPayout, rule.label, referenceId, 'daily_match');

    const commission = await prisma.commission.create({
      data: {
        userId: dbUser.id,
        amount: actualPayout,
        type: rule.label,
        status: 'Paid',
        date: new Date(),
        description: `Daily Match Bonus - ${matchedPV} PV matched at 8% = $${actualPayout.toFixed(2)}`,
      },
    });

    try {
      await prisma.notification.create({
        data: {
          memberId: dbUser.id,
          type: 'in_app',
          category: 'commission',
          title: `Daily Match Bonus: $${actualPayout.toFixed(2)}`,
          body: `You earned $${actualPayout.toFixed(2)} in Daily Match Bonus. ${matchedPV.toLocaleString()} PV matched at 8%.`,
          data: {
            commissionIds: [commission.id],
            commissionType: rule.label,
            amount: actualPayout,
            matchedPV,
            link: '/commission',
          },
          priority: 'high',
          isRead: false,
          isSent: false,
        },
      });
    } catch (notifErr: unknown) {
      logger.warn('Failed to create Daily Match notification', {
        error: notifErr instanceof Error ? notifErr.message : 'Unknown',
        userId: dbUser.id,
      });
    }

    try {
      const downlineUser = await prisma.user.findUnique({
        where: { id: dbUser.id },
        select: { placementParentId: true },
      });

      if (downlineUser?.placementParentId) {
        const { triggerMatchingBonusCascade } = await import('@/services/daily-match-trigger');
        await triggerMatchingBonusCascade(dbUser.id, actualPayout);
      }
    } catch (mbErr) {
      logger.error('Error triggering Matching Bonus', {
        error: mbErr instanceof Error ? mbErr.message : 'Unknown',
        userId: dbUser.id,
      });
    }

    const debugInfo = {
      calculation: {
        step1_livePV: { left: leftWaitingPV, right: rightWaitingPV },
        step4_matchedPV: { formula: `min(${leftWaitingPV}, ${rightWaitingPV})`, result: matchedPV },
        step5_remainingWaitingPV: {
          leftRemaining: leftAfterMatch,
          rightRemaining: rightAfterMatch,
        },
        step6_commission: {
          rawCommission: `${matchedPV} × 8% = $${rawCommission.toFixed(2)}`,
          dailyCapAmount,
          actualPayout: `$${actualPayout.toFixed(2)}`,
        },
      },
    };

    return NextResponse.json(
      {
        success: true,
        message: `Daily Match: ${matchedPV} PV matched at 8% = $${actualPayout.toFixed(2)} credited.`,
        commission: {
          amount: actualPayout,
          rate: DAILY_MATCH_RATE * 100,
          matchedPV,
          teamPV: {
            leftWaiting: leftWaitingPV,
            rightWaiting: rightWaitingPV,
            leftAfterMatch,
            rightAfterMatch,
            sponsorRank: dbUser.rank,
            commissionRate: DAILY_MATCH_RATE * 100,
            commissionAmount: rawCommission,
          },
        },
        waitingPV: { left: leftAfterMatch, right: rightAfterMatch },
        dailyCapAmount,
        debug: debugInfo,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('Daily Match error', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
