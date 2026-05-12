/**
 * GET /api/pv-matching/current-period
 * Get current period volume data for a member (sponsor)
 * Returns: Left PV, Right PV, Waiting PV, Matched PV, Member counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { PVMatchingService } from '@/services/pv-matching-service';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/lib/api-response';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    return await requireAuth(async (req: AuthenticatedRequest) => {
      const user = req.user!;
      const { searchParams } = new URL(request.url);
      
      // Allow admins and stockists to query other users, otherwise use authenticated user
      const targetUserId = searchParams.get('userId') || user.id;
      
      // Check if user is AdminStock (has storeOwnerLevel S, M, C, D)
      let isAdminStock = user.isAdmin;
      if (!isAdminStock) {
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { storeOwnerLevel: true }
        });
        isAdminStock = fullUser?.storeOwnerLevel ? ['S', 'M', 'C', 'D'].includes(fullUser.storeOwnerLevel) : false;
      }
      
      // Allow admins and AdminStock to query other users
      if (targetUserId !== user.id && !user.isAdmin && !isAdminStock) {
        return ApiResponseUtil.forbidden('Only admins or stockists can query other users');
      }

      // Get current period volume
      const volumeData = await PVMatchingService.getCurrentPeriodVolume(targetUserId);

      // AUTO-TRIGGER: If both legs have waiting PV, process match immediately.
      // Waiting PV is always updated (Left -= Matched, Right -= Matched) even if daily cap reached.
      if (volumeData.leftWaitingPV > 0 && volumeData.rightWaitingPV > 0) {
        try {
          const { processDirectDailyMatch } = await import('@/services/daily-match-trigger');
          const result = await processDirectDailyMatch(targetUserId);

          if (result.success) {
            logger.info('Auto-trigger succeeded', {
              userId: targetUserId,
              matchedPV: result.matchedPV,
              commission: result.commission,
              commissionPaid: (result.commission || 0) > 0,
              note: 'PV subtracted normally, commission may be 0 if daily cap reached'
            });

            // Capture waiting PV AFTER match: refresh from DB (source of truth).
            // getCurrentPeriodVolume uses getWaitingPV (users.left/rightWaitingPV) and
            // getTodayMatchedPVFromTransactions (pv_match_transactions.matched_pv).
            const updatedVolume = await PVMatchingService.getCurrentPeriodVolume(targetUserId);
            volumeData.leftWaitingPV = updatedVolume.leftWaitingPV;
            volumeData.rightWaitingPV = updatedVolume.rightWaitingPV;
            volumeData.matchedPV = updatedVolume.matchedPV;
          } else {
            logger.debug('Auto-trigger skipped', {
              userId: targetUserId,
              reason: result.reason
            });
          }
        } catch (autoTriggerError) {
          logger.warn('Auto-trigger error (non-blocking)', {
            userId: targetUserId,
            error: autoTriggerError instanceof Error ? autoTriggerError.message : 'Unknown'
          });
        }
      }

      logger.info('Current period volume fetched', {
        userId: targetUserId,
        leftPV: volumeData.leftPV,
        rightPV: volumeData.rightPV,
        matchedPV: volumeData.matchedPV
      }, request);

      return NextResponse.json({
        success: true,
        data: volumeData
      }, { status: 200 });
    })(request);
  } catch (error) {
    logger.error('Failed to fetch current period volume', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error('Failed to fetch current period volume');
  }
}

