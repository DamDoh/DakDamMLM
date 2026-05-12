import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash topup requests API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request - require authentication for all ecash operations
    const authenticatedRequest = await requireAuth(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    // Check if user is authenticated
    if (authenticatedRequest.status === 401) {
      return authenticatedRequest;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 records
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate query parameters
    if (status && !['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status parameter' },
        { status: 400 }
      );
    }

    // Check if EcashTopupRequest model is available
    if (!(prisma as any).ecashTopupRequest) {
      logger.error('EcashTopupRequest model not available in Prisma client', {
        userId: (authenticatedRequest as any).user?.id,
        status,
        attemptedOperation: 'fetch'
      }, request);

      return NextResponse.json(
        {
          error: 'Ecash topup functionality is not yet available',
          details: 'Database models are being updated'
        },
        { status: 503 } // 503 Service Unavailable
      );
    }

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    // If not admin, only show user's own requests
    if (!(authenticatedRequest as any).user?.isAdmin) {
      whereClause.memberId = (authenticatedRequest as any).user.id;
    }

    const topupRequests = await (prisma as any).ecashTopupRequest.findMany({
      where: whereClause,
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true,
            email: true
          }
        }
      },
      orderBy: { createdDate: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await (prisma as any).ecashTopupRequest.count({ where: whereClause });

    logger.info('Ecash topup requests fetched', {
      userId: (authenticatedRequest as any).user?.id,
      count: topupRequests.length,
      status,
      isAdmin: (authenticatedRequest as any).user?.isAdmin
    }, request);

    return NextResponse.json({
      success: true,
      data: topupRequests,
      pagination: {
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    });
  } catch (error) {
    logger.error('Ecash topup requests API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 10 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash topup creation', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request
    const authenticatedRequest = await requireAuth(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();
    const { amount, remark, proofUrl } = body;

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: 'Amount exceeds maximum allowed topup limit' },
        { status: 400 }
      );
    }

    // Validate proof URL is provided for amounts over $100
    if (amount > 100 && !proofUrl) {
      return NextResponse.json(
        { error: 'Proof of payment is required for amounts over $100' },
        { status: 400 }
      );
    }

    // Check if model is available
    if (!(prisma as any).ecashTopupRequest) {
      logger.error('EcashTopupRequest model not available', {
        userId: user.id,
        amount
      }, request);

      return NextResponse.json(
        { error: 'Ecash topup functionality is not yet available' },
        { status: 503 }
      );
    }

    // Create topup request
    const topupRequest = await (prisma as any).ecashTopupRequest.create({
      data: {
        memberId: user.id,
        memberName: user.fullName,
        amount,
        remark: remark || '',
        proofUrl: proofUrl || '',
        status: 'PENDING'
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true,
            email: true
          }
        }
      }
    });

    // Trigger notification to admins
    try {
      const { triggerEcashTopupRequestNotification } = await import('@/services/notification-service');
      await triggerEcashTopupRequestNotification({
        memberId: user.id,
        memberName: user.fullName,
        amount
      });
    } catch (notifError) {
      logger.warn('Failed to send ecash topup notification', {
        requestId: topupRequest.id,
        error: notifError instanceof Error ? notifError.message : 'Unknown error'
      }, request);
    }

    logger.info('E-cash topup request created', {
      userId: user.id,
      requestId: topupRequest.id,
      amount,
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json({
      success: true,
      data: topupRequest,
      message: 'E-cash topup request submitted successfully'
    });

  } catch (error) {
    logger.error('E-cash topup creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json(
      { error: 'Failed to create e-cash topup request' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 50 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate request - require admin for approval
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PENDING, APPROVED, REJECTED, or COMPLETED' },
        { status: 400 }
      );
    }

    // Check if model is available
    if (!(prisma as any).ecashTopupRequest) {
      return NextResponse.json(
        { error: 'Ecash topup functionality is not yet available' },
        { status: 503 }
      );
    }

    // Get the request to validate and process
    const existingRequest = await (prisma as any).ecashTopupRequest.findUnique({
      where: { id: requestId },
      include: {
        member: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'E-cash topup request not found' },
        { status: 404 }
      );
    }

    // Update the request
    const updatedRequest = await (prisma as any).ecashTopupRequest.update({
      where: { id: requestId },
      data: {
        status,
        processedBy: user.id,
        processedDate: new Date()
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true,
            email: true
          }
        }
      }
    });

    // If approved, create commission record
    if (status === 'APPROVED' || status === 'COMPLETED') {
      await prisma.commission.create({
        data: {
          id: `TOPUP-${requestId}-${Date.now()}`,
          userId: existingRequest.memberId,
          date: new Date(),
          type: 'E-Cash Topup',
          status: 'Paid',
          amount: existingRequest.amount
        }
      });

      logger.info('E-cash topup approved and commission created', {
        requestId,
        memberId: existingRequest.memberId,
        amount: existingRequest.amount
      });
    }

    logger.info('E-cash topup request updated', {
      userId: user.id,
      requestId,
      newStatus: status,
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `E-cash topup request ${status.toLowerCase()} successfully`
    });

  } catch (error) {
    logger.error('E-cash topup update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json(
      { error: 'Failed to update e-cash topup request' },
      { status: 500 }
    );
  }
}