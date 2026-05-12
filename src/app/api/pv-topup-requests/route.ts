import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { shouldUpdateRank, type Rank } from '@/lib/rank';

// GET: list PV top-up requests (pending by default). Non-admins only see their own.
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) return rateLimitResult.response!;

    let auth: AuthenticatedRequest | null = null;
    let user: any = null;
    try {
      auth = await authenticateRequest(request);
      user = auth.user;
    } catch (err) {
      const message = err instanceof AuthenticationError ? err.message : 'Authentication required';
      logger.warn('PV top-up GET auth failed', { message }, request);
      return NextResponse.json({ success: true, data: [] });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status = statusParam ? statusParam.toLowerCase() : null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (status && !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 });
    }

    const where: any = {};
    if (status) where.status = status;
    if (!user?.isAdmin) where.memberId = user?.id;

    const requests = await (prisma as any).ecommTopupRequest.findMany({
      where,
      include: {
        member: {
          select: { id: true, firstName: true, surname: true, memberId: true, email: true },
        },
      },
      orderBy: { createdDate: 'desc' },
      take: limit,
      skip: offset,
    });
    const total = await (prisma as any).ecommTopupRequest.count({ where });

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      },
    });
  } catch (error) {
    logger.error('PV top-up GET error', { error: error instanceof Error ? error.message : String(error) }, request);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: member submits a PV top-up request
export async function POST(request: NextRequest) {
  try {
    let auth: AuthenticatedRequest;
    let user: any;
    try {
      auth = await authenticateRequest(request);
      user = auth.user;
    } catch (err) {
      const message = err instanceof AuthenticationError ? err.message : 'Authentication required';
      return NextResponse.json({ error: 'Unauthorized', message }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100000, // Optimized for 100M+ users
      keyGenerator: () => `pv-topup:${user.id}`,
    });
    if (!rateLimitResult.success) return rateLimitResult.response!;

    const body = await request.json();
    const { pvAmount, remark, proofUrl } = body || {};

    if (!pvAmount || Number(pvAmount) <= 0) {
      return NextResponse.json({ error: 'PV amount must be greater than 0' }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, fullName: true, email: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pvAmountNumber = Number(pvAmount);

    // Create PV topup request (no balance check needed - admin will approve and credit PV)
    const requestRecord = await (prisma as any).ecommTopupRequest.create({
      data: {
        memberId: user.id,
        memberName: dbUser.fullName || dbUser.email || 'Unknown User',
        amount: pvAmountNumber,
        remark: remark || '',
        proofUrl: proofUrl || '',
        status: 'pending',
      },
      include: {
        member: {
          select: { id: true, firstName: true, surname: true, memberId: true, email: true },
        },
      },
    });

    // Notify admins about the new PV top-up request (in-app notification)
    try {
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true, email: true },
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            memberId: admin.id,
            type: 'in_app',
            category: 'system',
            title: 'New PV Top-up Request',
            body: `${dbUser.fullName || dbUser.email || 'A member'} requested a PV top-up of ${pvAmountNumber}.`,
            data: {
              requestId: requestRecord.id,
              memberId: user.id,
              memberEmail: dbUser.email,
              pvAmount: pvAmountNumber,
              remark: remark || '',
              link: `/admin/topup-requests?requestId=${requestRecord.id}`,
            },
            priority: 'medium',
          })),
        });
      }
    } catch (notifyErr) {
      logger.warn('PV top-up POST notification create failed', { error: String(notifyErr) }, request);
    }

    return NextResponse.json({
      success: true,
      data: requestRecord,
      message: 'PV top-up request submitted successfully',
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('PV top-up POST error', { 
      error: errorMessage, 
      stack: errorStack,
      errorDetails: error 
    }, request);
    
    // Return more detailed error for debugging
    return NextResponse.json({ 
      error: 'Failed to submit PV top-up request',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

// PATCH: admin approves/rejects a PV top-up request; on approve, credit PV and update rank
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) return rateLimitResult.response!;

    let auth: AuthenticatedRequest;
    let user: any;
    try {
      auth = await authenticateRequest(request);
      user = auth.user;
      if (!user?.isAdmin) {
        return NextResponse.json({ error: 'Forbidden', message: 'Admin access required' }, { status: 403 });
      }
    } catch (err) {
      const message = err instanceof AuthenticationError ? err.message : 'Authentication required';
      return NextResponse.json({ error: 'Unauthorized', message }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, status, adjustedAmount } = body || {};
    if (!requestId || !status) {
      return NextResponse.json({ error: 'Request ID and status are required' }, { status: 400 });
    }
    const normalizedStatus = String(status).toLowerCase();
    if (!['pending', 'approved', 'rejected', 'completed'].includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existing = await (prisma as any).ecommTopupRequest.findUnique({
      where: { id: requestId },
      include: { member: { select: { id: true, pv: true, rank: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'PV top-up request not found' }, { status: 404 });
    }

    const amountToUse =
      adjustedAmount !== undefined && adjustedAmount !== null
        ? Number(adjustedAmount)
        : Number(existing.amount);
    if (!Number.isFinite(amountToUse) || amountToUse <= 0) {
      return NextResponse.json({ error: 'Invalid PV amount' }, { status: 400 });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Update request status (and amount if adjusted)
      const updated = await (tx as any).ecommTopupRequest.update({
        where: { id: requestId },
        data: {
          status: normalizedStatus,
          processedBy: user.id,
          processedDate: new Date(),
          ...(amountToUse !== existing.amount ? { amount: amountToUse } : {}),
        },
      });

      let rankWasUpdated = false;
      let memberIdForBonus: string | null = null;
      let oldRank: string | null = null;
      let newRank: string | null = null;
      let oldPV: number = 0;
      let newPV: number = 0;

      // If approved/completed, credit PV and handle rank promotion
      if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
        const member = await tx.user.findUnique({ where: { id: existing.memberId }, select: { pv: true, rank: true } });
        if (!member) {
          throw new Error('Member not found');
        }
        oldPV = member.pv ?? 0;
        newPV = oldPV + amountToUse;
        // Ensure rank is defined, default to 'Member' if missing
        const currentRank = (member.rank || 'Member') as Rank;
        oldRank = currentRank;
        const rankCheck = shouldUpdateRank(currentRank, newPV);

        rankWasUpdated = rankCheck.shouldUpdate && rankCheck.newRank !== 'Member';
        memberIdForBonus = existing.memberId;
        newRank = rankCheck.shouldUpdate ? rankCheck.newRank : currentRank;
        
        await tx.user.update({
          where: { id: existing.memberId },
          data: {
            pv: newPV,
            pvDate: new Date(),
            ...(rankCheck.shouldUpdate ? { rank: rankCheck.newRank as any } : {}),
          },
        });
      } else if (normalizedStatus === 'rejected') {
        // No refund needed - PV topup requests don't deduct anything upfront
      }

      return { updated, rankWasUpdated, memberIdForBonus, oldRank, newRank, oldPV, newPV };
    });

    // Handle PV change for upline sponsors (recalculate waiting PV)
    if (updatedRequest.oldPV !== undefined && updatedRequest.newPV !== undefined && updatedRequest.newPV > updatedRequest.oldPV) {
      try {
        const { PVMatchingService } = await import('@/services/pv-matching-service');
        await PVMatchingService.handlePVChange(
          existing.memberId,
          updatedRequest.oldPV,
          updatedRequest.newPV
        );
      } catch (pvError: any) {
        console.error('[PATCH /api/pv-topup-requests] Failed to handle PV change for upline sponsors:', pvError);
        // Don't fail the request if PV matching fails
      }
    }

    // If rank was updated and member is now Bronze or above, check for Binary Bonus
    // Do this after transaction completes to avoid nested transactions
    if (updatedRequest.rankWasUpdated && updatedRequest.memberIdForBonus) {
      try {
        const { calculateBinaryBonusOnRankChange } = await import('@/lib/referral-tracking');
        // Pass the actual PV amount added (amountToUse) for binary bonus calculation
        const pvAdded = updatedRequest.newPV - updatedRequest.oldPV;
        await calculateBinaryBonusOnRankChange(updatedRequest.memberIdForBonus, pvAdded);
      } catch (error) {
        console.error('Failed to calculate Binary Bonus on rank change:', error);
        // Don't fail the request if Binary Bonus calculation fails
      }
    }

    // If rank changed, add PV to upline sponsors' waiting legs
    if (updatedRequest.rankWasUpdated && updatedRequest.memberIdForBonus && updatedRequest.oldRank && updatedRequest.newRank) {
      try {
        const { PVMatchingService } = await import('@/services/pv-matching-service');
        await PVMatchingService.handleRankChange(updatedRequest.memberIdForBonus, updatedRequest.oldRank, updatedRequest.newRank);
      } catch (error) {
        console.error('Failed to handle rank change for PV matching:', error);
        // Don't fail the request if PV matching fails
      }

      // If member upgraded from "Member" rank, trigger G2 Binary Bonus for their grandparent
      if (updatedRequest.oldRank === 'Member' && updatedRequest.newRank !== 'Member') {
        try {
          // Get member's placement parent (G1)
          const member = await prisma.user.findFirst({
            where: { memberId: updatedRequest.memberIdForBonus },
            select: { id: true, placementParentId: true }
          });

          if (member?.placementParentId) {
            const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
            await autoCalculateG2BinaryBonus(member.placementParentId, member.id);
            console.log(`G2 Binary Bonus auto-calculated after rank change for ${updatedRequest.memberIdForBonus}`);
          }
        } catch (g2Error) {
          console.error('Failed to auto-calculate G2 Binary Bonus on rank change:', g2Error);
          // Don't fail if G2 calculation fails
        }
      }
    }

    // Notify member about the status change
    try {
      const isApproved = normalizedStatus === 'approved' || normalizedStatus === 'completed';
      const notificationTitle = isApproved 
        ? 'PV Top-up Request Approved' 
        : 'PV Top-up Request Rejected';
      const notificationBody = isApproved
        ? `Your PV top-up request for ${amountToUse.toLocaleString()} PV has been approved. ${amountToUse.toLocaleString()} PV has been added to your account.`
        : `Your PV top-up request for ${existing.amount.toLocaleString()} PV has been rejected. Please contact support if you have questions.`;

      await prisma.notification.create({
        data: {
          memberId: existing.memberId,
          type: 'in_app',
          category: 'system',
          title: notificationTitle,
          body: notificationBody,
          data: {
            requestId: requestId,
            memberId: existing.memberId,
            pvAmount: amountToUse,
            status: normalizedStatus,
            adjustedAmount: amountToUse !== existing.amount,
            originalAmount: existing.amount,
            link: '/ecash',
          },
          priority: isApproved ? 'medium' : 'high',
        },
      });
    } catch (notifyErr) {
      logger.warn('PV top-up PATCH notification create failed', { error: String(notifyErr) }, request);
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `PV top-up request ${normalizedStatus} successfully`,
    });
  } catch (error) {
    logger.error('PV top-up PATCH error', { error: error instanceof Error ? error.message : String(error) }, request);
    return NextResponse.json({ error: 'Failed to update PV top-up request' }, { status: 500 });
  }
}

