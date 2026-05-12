import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAdmin, authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash topup requests API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request - require authentication for all ecash operations
    let authenticatedRequest: AuthenticatedRequest;
    let user: any;
    
    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      logger.warn('Authentication failed for topup requests fetch', {
        error: message,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: 0,
          offset: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get('status');
    const status = rawStatus ? rawStatus.toUpperCase() : null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 records
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate query parameters
    if (status && !['pending', 'approved', 'rejected', 'completed'].includes(status.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid status parameter' },
        { status: 400 }
      );
    }

    // Check if EcommTopupRequest model is available
    if (!(prisma as any).ecommTopupRequest) {
      logger.error('EcommTopupRequest model not available in Prisma client', {
        userId: user?.id,
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
      whereClause.status = status.toLowerCase();
    }

    // If not admin, only show user's own requests
    if (!user?.isAdmin) {
      whereClause.memberId = user.id;
    }

    const topupRequests = await (prisma as any).ecommTopupRequest.findMany({
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

    const total = await (prisma as any).ecommTopupRequest.count({ where: whereClause });

    logger.info('Ecash topup requests fetched', {
      userId: user?.id,
      count: topupRequests.length,
      status,
      isAdmin: user?.isAdmin
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
  let user: any = null;

  try {
    // Authenticate request first to get user ID for rate limiting
    let authenticatedRequest: AuthenticatedRequest;
    
    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      logger.warn('Authentication failed for topup request', {
        error: message,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message,
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }
    
    if (!user || !user.id) {
      logger.error('User not found in authenticated request', {
        hasUser: !!user
      }, request);
      return NextResponse.json(
        { 
          error: 'Authentication failed',
          message: 'User authentication failed. Please log in again.'
        },
        { status: 401 }
      );
    }

    // Apply rate limiting based on user ID (more accurate than IP)
    const rateLimitResult = await rateLimit(request, { 
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100000, // Optimized for 100M+ users
      keyGenerator: () => `ecash-topup:${user.id}` // Rate limit per user, not IP
    });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash topup creation', {
        userId: user.id,
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }
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

    // Verify user exists in database before creating request
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, fullName: true, email: true }
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Create topup request - use type assertion for extended Prisma client
    let topupRequest;
    try {
      topupRequest = await (prisma as any).ecommTopupRequest.create({
        data: {
          memberId: user.id,
          memberName: dbUser.fullName || dbUser.email || 'Unknown User',
          amount,
          remark: remark || '',
          proofUrl: proofUrl || '',
          status: 'pending'
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

      // Verify topup request was created successfully
      if (!topupRequest) {
        logger.error('Topup request creation returned undefined', {
          userId: user.id,
          amount
        }, request);
        throw new Error('Failed to create topup request - no data returned');
      }
      
      if (!topupRequest.id) {
        logger.error('Topup request created but missing ID', {
          userId: user.id,
          amount,
          topupRequest
        }, request);
        throw new Error('Failed to create topup request - no ID returned');
      }
    } catch (dbError: any) {
      // Handle database errors
      const errorMsg = dbError.message || String(dbError);
      
      logger.error('Database error creating topup request', {
        error: errorMsg,
        userId: user.id,
        amount,
        stack: dbError.stack
      }, request);
      
      if (errorMsg.includes('does not exist') || errorMsg.includes('Unknown model')) {
        return NextResponse.json(
          { 
            error: 'Database table not found',
            message: 'The ecomm_topup_requests table does not exist. Please contact administrator.'
          },
          { status: 503 }
        );
      }
      
      // Re-throw other database errors to be caught by outer catch block
      throw dbError;
    }

    // Trigger notification to admins
    try {
      const { triggerEcashTopupRequestNotification } = await import('@/services/notification-service');
      await triggerEcashTopupRequestNotification({
        id: topupRequest.id,
        memberId: user.id,
        memberName: dbUser.fullName || dbUser.email || 'Unknown User',
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
    const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check for specific Prisma errors
    let statusCode = 500;
    let userMessage = 'Failed to create e-cash topup request';
    
    if (errorMessage.includes('Unique constraint')) {
      statusCode = 409;
      userMessage = 'A topup request with this information already exists';
    } else if (errorMessage.includes('Foreign key constraint') || errorMessage.includes('User')) {
      statusCode = 404;
      userMessage = 'User not found in database';
    } else if (errorMessage.includes('Record to update not found')) {
      statusCode = 404;
      userMessage = 'Request not found';
    } else if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown model')) {
      statusCode = 503;
      userMessage = 'Database table not available. Please contact administrator.';
    }
    
    logger.error('E-cash topup creation error', {
      error: errorMessage,
      stack: errorStack,
      ip: request.headers.get('x-forwarded-for'),
      userId: user?.id,
      statusCode,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, request);

    // Return more specific error message in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        error: userMessage,
        message: userMessage,
        ...(isDevelopment && { 
          details: errorMessage,
          stack: errorStack 
        })
      },
      { status: statusCode }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate request - require admin for approval
    let authenticatedRequest: AuthenticatedRequest;
    
    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
      
      if (!user?.isAdmin) {
        logger.warn('Non-admin user attempted to update topup request', {
          userId: user?.id,
          ip: request.headers.get('x-forwarded-for')
        }, request);
        
        return NextResponse.json(
          { 
            error: 'Forbidden',
            message: 'Admin access required' 
          },
          { status: 403 }
        );
      }
    } catch (authError) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      logger.warn('Authentication failed for topup request update', {
        error: message,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message,
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { requestId, status, adjustedAmount } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    const normalizedStatus = status.toLowerCase();
    if (!validStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, approved, rejected, or completed' },
        { status: 400 }
      );
    }

    // Get the request to validate and process
    const existingRequest = await (prisma as any).ecommTopupRequest.findUnique({
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

    // Determine the amount to use (adjusted amount if provided, otherwise use existing)
    const amountToUse = adjustedAmount !== undefined && adjustedAmount !== null 
      ? parseFloat(String(adjustedAmount))
      : existingRequest.amount;

    // Validate amount
    if (isNaN(amountToUse) || amountToUse <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      status: normalizedStatus,
      processedBy: user.id,
      processedDate: new Date()
    };

    // Only update amount if it was adjusted
    if (adjustedAmount !== undefined && adjustedAmount !== null && parseFloat(String(adjustedAmount)) !== existingRequest.amount) {
      updateData.amount = amountToUse;
    }

    // Use transaction to ensure atomicity of update and commission creation
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Update the request
      const updated = await (tx as any).ecommTopupRequest.update({
        where: { id: requestId },
        data: updateData,
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

      // If approved, create commission record AND update user's wallet balance AND PV AND rank
      if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
        // Create commission record
        await tx.commission.create({
          data: {
            userId: existingRequest.memberId,
            date: new Date(),
            type: 'E-Cash Topup',
            status: 'Paid',
            amount: amountToUse
          }
        });

        // Get current user data to calculate new PV and rank
        const currentUser = await tx.user.findUnique({
          where: { id: existingRequest.memberId },
          select: { pv: true, rank: true }
        });

        const oldRank = currentUser?.rank || 'Member';
        const oldPV = currentUser?.pv || 0;
        const newPV = oldPV + amountToUse;

        // Calculate new rank based on PV
        const { calculateRank } = await import('@/lib/rank');
        const newRank = calculateRank(newPV);

        // Update user's PV and rank
        await tx.user.update({
          where: { id: existingRequest.memberId },
          data: {
            pv: newPV,
            rank: newRank
          }
        });

        // Track rank change and PV change for PV matching
        if (newRank !== oldRank) {
          // Store in transaction result for later processing
          (updated as any)._rankChange = { oldRank, newRank, memberId: existingRequest.memberId };
        }
        // Store PV change for later processing
        (updated as any)._pvChange = { oldPV, newPV, memberId: existingRequest.memberId };

        // Update user's wallet balance - add the topup amount
        const userWallet = await tx.wallet.findUnique({
          where: { userId: existingRequest.memberId }
        });

        if (userWallet) {
          // Get current balance before update
          const balanceBefore = userWallet.balance;
          const balanceAfter = balanceBefore + amountToUse;

          // Update existing wallet
          await tx.wallet.update({
            where: { userId: existingRequest.memberId },
            data: {
              balance: balanceAfter
            }
          });

          // Create wallet transaction record (positive amount for topup)
          await tx.walletTransaction.create({
            data: {
              walletId: userWallet.id,
              type: 'credit',
              amount: amountToUse,
              balanceBefore: balanceBefore,
              balanceAfter: balanceAfter,
              description: `E-Cash Top-up Request #${requestId.slice(0, 8)} approved`,
              status: 'completed',
              referenceType: 'ecash_topup',
              referenceId: requestId
            }
          });
        } else {
          // Create wallet if it doesn't exist
          const newWallet = await tx.wallet.create({
            data: {
              userId: existingRequest.memberId,
              balance: amountToUse,
              currency: 'USD',
              isActive: true
            }
          });

          // Create wallet transaction record (positive amount for topup)
          await tx.walletTransaction.create({
            data: {
              walletId: newWallet.id,
              type: 'credit',
              amount: amountToUse,
              balanceBefore: 0,
              balanceAfter: amountToUse,
              description: `E-Cash Top-up Request #${requestId.slice(0, 8)} approved`,
              status: 'completed',
              referenceType: 'ecash_topup',
              referenceId: requestId
            }
          });
        }
      }

      return updated;
    });

    // Handle PV change for upline sponsors (recalculate waiting PV)
    if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
      const pvChange = (updatedRequest as any)?._pvChange;
      if (pvChange && pvChange.newPV > pvChange.oldPV) {
        try {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          await PVMatchingService.handlePVChange(
            pvChange.memberId,
            pvChange.oldPV,
            pvChange.newPV
          );
        } catch (pvError: any) {
          console.error('[PATCH /api/ecash-topup-requests] Failed to handle PV change for upline sponsors:', pvError);
          // Don't fail the request if PV matching fails
        }
      }
    }

    if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
      logger.info('E-cash topup approved and commission created', {
        requestId,
        memberId: existingRequest.memberId,
        amount: amountToUse,
        originalAmount: existingRequest.amount,
        adjusted: adjustedAmount !== undefined
      });

      // If rank changed, add PV to upline sponsors' waiting legs
      const rankChange = (updatedRequest as any)._rankChange;
      if (rankChange) {
        try {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          await PVMatchingService.handleRankChange(rankChange.memberId, rankChange.oldRank, rankChange.newRank);
        } catch (error) {
          console.error('Failed to handle rank change for PV matching:', error);
          // Don't fail the request if PV matching fails
        }

        // Calculate Binary Bonus if rank was updated and member is now Bronze or above
        if (rankChange.newRank !== 'Member') {
          try {
            const { calculateBinaryBonusOnRankChange } = await import('@/lib/referral-tracking');
            // Pass the actual PV amount added (amountToUse) for binary bonus calculation
            const pvChange = (updatedRequest as any)?._pvChange;
            const pvAdded = pvChange ? (pvChange.newPV - pvChange.oldPV) : amountToUse;
            await calculateBinaryBonusOnRankChange(rankChange.memberId, pvAdded);
          } catch (error) {
            console.error('Failed to calculate Binary Bonus on rank change:', error);
            // Don't fail the request if Binary Bonus calculation fails
          }

          // AUTO-CALCULATE G2 Binary Bonus for grandparent when this member (as G2) becomes eligible
          try {
            const member = await prisma.user.findUnique({
              where: { id: rankChange.memberId },
              select: { placementParentId: true }
            });

            if (member?.placementParentId) {
              const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
              await autoCalculateG2BinaryBonus(member.placementParentId, rankChange.memberId);
              console.log(`[PATCH /api/ecash-topup-requests] Auto-calculated G2 Binary Bonus after rank change for ${rankChange.memberId}`);
            }
          } catch (g2Error) {
            console.error('Failed to auto-calculate G2 Binary Bonus:', g2Error);
            // Don't fail the request if G2 calculation fails
          }
        }
      }
    }

    // Notify member about the status change
    try {
      const isApproved = normalizedStatus === 'approved' || normalizedStatus === 'completed';
      const notificationTitle = isApproved 
        ? 'E-Cash Top-up Request Approved' 
        : 'E-Cash Top-up Request Rejected';
      const notificationBody = isApproved
        ? `Your E-Cash top-up request for ${amountToUse.toLocaleString()} PV has been approved. ${amountToUse.toLocaleString()} PV points have been added to your balance.`
        : `Your E-Cash top-up request for ${existingRequest.amount.toLocaleString()} PV has been rejected. Please contact support if you have questions.`;

      await prisma.notification.create({
        data: {
          memberId: existingRequest.memberId,
          type: 'in_app',
          category: 'system',
          title: notificationTitle,
          body: notificationBody,
          data: {
            requestId: requestId,
            memberId: existingRequest.memberId,
            amount: amountToUse,
            status: normalizedStatus,
            adjustedAmount: amountToUse !== existingRequest.amount,
            originalAmount: existingRequest.amount,
            link: '/ecash',
          },
          priority: isApproved ? 'medium' : 'high',
        },
      });
    } catch (notifyErr) {
      logger.warn('E-cash topup PATCH notification create failed', { 
        error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr) 
      }, request);
    }

    // UPLINE CASCADE: When a member gets PV from an e-cash topup, trigger recalculation
    // for all upline sponsors since their leg totals have changed
    if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
      try {
        const { triggerUplineCascade } = await import('@/services/daily-match-trigger');
        await triggerUplineCascade(existingRequest.memberId);
      } catch (cascadeError) {
        logger.warn('Failed to trigger upline cascade', {
          error: cascadeError instanceof Error ? cascadeError.message : 'Unknown error',
          memberId: existingRequest.memberId
        }, request);
        // Don't fail the request if cascade fails
      }
    }

    logger.info('E-cash topup request updated', {
      userId: user.id,
      requestId,
      newStatus: normalizedStatus,
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `E-cash topup request ${normalizedStatus} successfully`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('E-cash topup update error', {
      error: errorMessage,
      stack: errorStack,
      ip: request.headers.get('x-forwarded-for'),
      userId: user?.id,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, request);

    // Return more specific error message
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        error: 'Failed to update e-cash topup request',
        message: isDevelopment ? errorMessage : 'An error occurred while updating the request',
        ...(isDevelopment && { details: errorStack })
      },
      { status: 500 }
    );
  }
}