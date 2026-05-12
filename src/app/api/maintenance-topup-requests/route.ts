import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

// GET: list maintenance top-up requests (pending by default). Non-admins only see their own.
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
      logger.warn('Maintenance top-up GET auth failed', { message }, request);
      return NextResponse.json({ success: true, data: [] });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status = statusParam ? statusParam.toLowerCase() : null;
    const month = searchParams.get('month'); // YYYY-MM format
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (status && !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 });
    }

    const where: any = {};
    if (status) where.status = status;
    if (month) where.month = month;
    if (!user?.isAdmin) where.memberId = user?.id;

    const requests = await prisma.maintenanceTopupRequest.findMany({
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
    const total = await prisma.maintenanceTopupRequest.count({ where });

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
    logger.error('Maintenance top-up GET error', { error: error instanceof Error ? error.message : String(error) }, request);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: automatically process maintenance using PV from Product Purchases
// Supports self (default) or Admin Stock paying for another member via targetMemberId
export async function PUT(request: NextRequest) {
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
      keyGenerator: () => `maintenance-auto:${user.id}`,
    });
    if (!rateLimitResult.success) return rateLimitResult.response!;

    const body = await request.json().catch(() => ({}));
    const targetMemberId = typeof body?.targetMemberId === 'string' ? body.targetMemberId : undefined;
    const requestedAmount = typeof body?.amount === 'number' ? Number(body.amount) : undefined;

    const dbActor = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, fullName: true, email: true, rank: true, pv: true, storeOwnerLevel: true, isAdmin: true, active: true, deleted: true },
    });
    if (!dbActor || dbActor.deleted || !dbActor.active) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 });
    }

    const isAdminStock = !!dbActor.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(dbActor.storeOwnerLevel);
    const isAdmin = !!dbActor.isAdmin;
    const canPayForOther = isAdminStock || isAdmin;
    const targetUserId = targetMemberId && canPayForOther ? targetMemberId : user.id;
    
    // For AdminStock: use stock_transfer, for regular members: use product_purchase
    const pvSourceType = isAdminStock ? 'stock_transfer' : 'product_purchase';

    if (targetMemberId && (!canPayForOther || targetMemberId === user.id)) {
      if (!canPayForOther) {
        return NextResponse.json({ error: 'Only Admin or Admin Stock can pay maintenance for another member' }, { status: 403 });
      }
    }

    if (targetMemberId && canPayForOther) {
      const target = await prisma.user.findUnique({
        where: { id: targetMemberId },
        select: { id: true, fullName: true, email: true, memberId: true, rank: true, active: true, deleted: true },
      });
      if (!target || target.deleted || !target.active) {
        return NextResponse.json({ error: 'Target member not found or inactive' }, { status: 404 });
      }
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, email: true, memberId: true, rank: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    const { getMaintenanceTopupAmount } = await import('@/lib/maintenance');
    const requiredAmount = getMaintenanceTopupAmount(targetUser.rank);
    const amountToUse = requestedAmount != null && requestedAmount >= requiredAmount
      ? requestedAmount
      : requiredAmount;

    const existingMaintenance = await prisma.maintenanceTopupRequest.findFirst({
      where: {
        memberId: targetUserId,
        month: currentMonth,
        status: { in: ['approved', 'completed'] },
      },
    });

    if (existingMaintenance) {
      return NextResponse.json({
        error: `Maintenance for ${currentMonth} is already paid`,
        message: targetUserId === user.id
          ? 'You have already paid maintenance for this month'
          : `Maintenance for ${targetUser.memberId || targetUserId} is already paid for this month`,
      }, { status: 400 });
    }

    // Admin (non–Admin Stock) paying for another member: no Product PV required
    const adminOnlyNoPV = isAdmin && !isAdminStock && targetUserId !== user.id;

    let wallet: { id: string; balance: number | null } | null = null;
    if (!adminOnlyNoPV) {
      let w = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!w) {
        w = await prisma.wallet.create({
          data: { userId: user.id, balance: 0, currency: 'USD', isActive: true },
        });
      }
      wallet = w;

      const totalPVResult = await prisma.walletTransaction.aggregate({
        where: { walletId: wallet.id, referenceType: pvSourceType, amount: { gt: 0 } },
        _sum: { amount: true },
      });
      const totalAvailablePV = Number(totalPVResult._sum.amount || 0);
      if (totalAvailablePV < amountToUse) {
        return NextResponse.json({
          error: isAdminStock ? 'Insufficient PV from Stock' : 'Insufficient PV from Product Purchases',
          message: isAdminStock 
            ? `You need ${amountToUse} PV from stock. You currently have ${totalAvailablePV} PV.`
            : `You need ${amountToUse} PV from product purchases. You currently have ${totalAvailablePV} PV.`,
          requiredAmount,
          availablePV: totalAvailablePV,
        }, { status: 400 });
      }
    }

    // Process maintenance automatically
    const result = await prisma.$transaction(async (tx) => {
      const processedDate = new Date();
      processedDate.setHours(0, 0, 0, 0);

      const remarkAdmin = targetUserId === user.id
        ? 'Automatic maintenance payment using PV from Product Purchases'
        : adminOnlyNoPV
          ? `Maintenance paid by Admin (${dbActor.fullName || dbActor.email || user.id})`
          : `Maintenance paid by ${isAdminStock ? 'Admin Stock' : 'Admin'} (${dbActor.fullName || dbActor.email || user.id})`;

      const maintenanceRequest = await tx.maintenanceTopupRequest.create({
        data: {
          memberId: targetUserId,
          memberName: targetUser.fullName || targetUser.email || 'Unknown User',
          amount: amountToUse,
          remark: remarkAdmin,
          proofUrl: '',
          month: currentMonth,
          status: 'completed',
          processedBy: user.id,
          processedDate,
        },
      });

      const deductedTransactions: Array<{ id: string; amount: number }> = [];
      let amountDeducted = 0;

      if (!adminOnlyNoPV && wallet) {
        const sourceTransactions = await tx.walletTransaction.findMany({
          where: {
            walletId: wallet.id,
            referenceType: pvSourceType,
            amount: { gt: 0 },
          },
          select: { id: true, amount: true, referenceId: true },
          orderBy: { createdAt: 'asc' },
          take: 100,
        });

        let remainingToDeduct = amountToUse;
        const transactionsToCreate: Array<{
          walletId: string;
          type: string;
          amount: number;
          balanceBefore: number;
          balanceAfter: number;
          description: string;
          referenceId: string;
          referenceType: string;
          status: string;
          createdAt: Date;
        }> = [];

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
            walletId: wallet!.id,
            type: 'debit',
            amount: -deductAmount,
            balanceBefore: wallet!.balance || 0,
            balanceAfter: wallet!.balance || 0,
            description: targetUserId === user.id
              ? `Maintenance Payment: Deducted from ${sourceDescription}`
              : `Maintenance Payment for Member: Deducted from ${sourceDescription}`,
            referenceId: maintenanceRequest.id,
            referenceType: 'maintenance_payment',
            status: 'completed',
            createdAt: new Date(),
          });
          deductedTransactions.push({ id: sourceTx.id, amount: deductAmount });
          remainingToDeduct -= deductAmount;
          amountDeducted += deductAmount;
        }

        if (transactionsToCreate.length > 0) {
          await tx.walletTransaction.createMany({ data: transactionsToCreate });
        }

        // Admin Stock paying for another member: add PV to member's PV/Product
        if (targetUserId !== user.id && isAdminStock) {
          let memberWallet = await tx.wallet.findUnique({ where: { userId: targetUserId } });
          if (!memberWallet) {
            memberWallet = await tx.wallet.create({
              data: { userId: targetUserId, balance: 0, currency: 'USD', isActive: true },
            });
          }
          await tx.walletTransaction.create({
            data: {
              walletId: memberWallet.id,
              type: 'credit',
              amount: amountToUse,
              balanceBefore: memberWallet.balance ?? 0,
              balanceAfter: memberWallet.balance ?? 0,
              description: `Maintenance top-up from Admin Stock (${dbActor.fullName || dbActor.email || 'Admin'})`,
              referenceId: maintenanceRequest.id,
              referenceType: 'product_purchase',
              status: 'completed',
              createdAt: new Date(),
            },
          });
        }
      }

      // Admin-only (no PV) paying for another member: create transaction record for member's history (no PV added)
      if (adminOnlyNoPV && targetUserId !== user.id) {
        let memberWallet = await tx.wallet.findUnique({ where: { userId: targetUserId } });
        if (!memberWallet) {
          memberWallet = await tx.wallet.create({
            data: { userId: targetUserId, balance: 0, currency: 'USD', isActive: true },
          });
        }
        await tx.walletTransaction.create({
          data: {
            walletId: memberWallet.id,
            type: 'credit',
            amount: amountToUse,
            balanceBefore: memberWallet.balance ?? 0,
            balanceAfter: memberWallet.balance ?? 0,
            description: `Maintenance paid by Admin (${dbActor.fullName || dbActor.email || 'Admin'})`,
            referenceId: maintenanceRequest.id,
            referenceType: 'maintenance_payment',
            status: 'completed',
            createdAt: new Date(),
          },
        });
      }

      return {
        maintenanceRequest,
        deductedTransactions,
        amountDeducted: amountDeducted || (adminOnlyNoPV ? 0 : amountToUse),
      };
    });

    logger.info('Automatic maintenance processed successfully', {
      userId: user.id,
      targetMemberId: targetUserId,
      month: currentMonth,
      amount: amountToUse,
      deductedTransactions: result.deductedTransactions.length,
    });

    const forOther = targetUserId !== user.id;
    const msg = adminOnlyNoPV && forOther
      ? `Maintenance for ${currentMonth} has been paid for member ${targetUser.memberId || targetUserId} by Admin.`
      : forOther
        ? `Maintenance for ${currentMonth} has been paid for member ${targetUser.memberId || targetUserId} using ${result.amountDeducted} PV from your Product Purchases.`
        : `Maintenance for ${currentMonth} has been automatically paid using ${result.amountDeducted} PV from Product Purchases`;
    return NextResponse.json({
      success: true,
      message: msg,
      data: {
        maintenanceRequest: result.maintenanceRequest,
        amountDeducted: result.amountDeducted,
        targetMemberId: forOther ? targetUserId : undefined,
        expiryDate: (() => {
          const t = new Date();
          t.setHours(0, 0, 0, 0);
          const year = t.getFullYear();
          const month = t.getMonth();
          const day = t.getDate();
          const nextMonth = month + 1;
          const lastDayNextMonth = new Date(year, nextMonth + 1, 0).getDate();
          const expiryDay = Math.min(day, lastDayNextMonth);
          return new Date(year, nextMonth, expiryDay, 23, 59, 59, 999);
        })(),
      },
    });
  } catch (error: any) {
    logger.error('Automatic maintenance processing error', {
      error: error?.message || String(error),
      stack: error?.stack,
    }, request);
    return NextResponse.json(
      {
        error: 'Failed to process automatic maintenance',
        message: error?.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

// POST: create manual maintenance top-up request (with proof upload)
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
      keyGenerator: () => `maintenance-request:${user.id}`,
    });
    if (!rateLimitResult.success) return rateLimitResult.response!;

    const body = await request.json();
    const { amount, remark, proofUrl, month, targetMemberId } = body;

    // Fetch user from database to get storeOwnerLevel (not in auth token)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, storeOwnerLevel: true, active: true, deleted: true },
    });

    if (!dbUser || dbUser.deleted || !dbUser.active) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 });
    }

    // Check if user is Admin Stock (can create requests for others)
    const isAdminStock = dbUser.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(dbUser.storeOwnerLevel);
    
    // Determine target user ID
    const targetUserId = targetMemberId && isAdminStock ? targetMemberId : user.id;
    
    // If Admin Stock is trying to create request for another member, verify they have permission
    if (targetMemberId && isAdminStock && targetMemberId !== user.id) {
      const targetMember = await prisma.user.findUnique({
        where: { id: targetMemberId },
        select: { id: true, active: true, deleted: true, fullName: true, email: true, rank: true },
      });
      
      if (!targetMember || targetMember.deleted || !targetMember.active) {
        return NextResponse.json({ error: 'Target member not found or inactive' }, { status: 404 });
      }
    } else if (targetMemberId && !isAdminStock) {
      return NextResponse.json({ error: 'Only Admin Stock can create maintenance requests for other members' }, { status: 403 });
    }

    // Get target member details
    const targetMember = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, email: true, memberId: true, rank: true },
    });

    if (!targetMember) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Validate month format (YYYY-MM)
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(currentMonth)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // Check if maintenance is already paid for this month
    const existingMaintenance = await prisma.maintenanceTopupRequest.findFirst({
      where: {
        memberId: targetUserId,
        month: currentMonth,
        status: { in: ['approved', 'completed'] },
      },
    });

    if (existingMaintenance) {
      return NextResponse.json({
        error: `Maintenance for ${currentMonth} is already paid`,
        message: `Maintenance for ${currentMonth} has already been paid for this member`,
      }, { status: 400 });
    }

    // Create maintenance topup request
    const maintenanceRequest = await prisma.maintenanceTopupRequest.create({
      data: {
        memberId: targetUserId,
        memberName: targetMember.fullName || targetMember.email || 'Unknown User',
        amount: Number(amount),
        remark: remark || (targetUserId !== user.id ? `Maintenance request created by Admin Stock for ${targetMember.memberId || targetUserId}` : ''),
        proofUrl: proofUrl || '',
        month: currentMonth,
        status: 'pending',
      },
    });

    logger.info('Maintenance top-up request created', {
      requestId: maintenanceRequest.id,
      userId: user.id,
      targetMemberId: targetUserId,
      month: currentMonth,
      amount,
    });

    return NextResponse.json({
      success: true,
      message: targetUserId === user.id
        ? 'Maintenance top-up request submitted successfully'
        : `Maintenance top-up request created for member ${targetMember.memberId || targetUserId}`,
      data: maintenanceRequest,
    });
  } catch (error: any) {
    logger.error('Maintenance top-up request creation error', {
      error: error?.message || String(error),
      stack: error?.stack,
    }, request);
    return NextResponse.json(
      {
        error: 'Failed to create maintenance top-up request',
        message: error?.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
