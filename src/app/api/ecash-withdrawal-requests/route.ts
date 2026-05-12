import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, requireAdmin, authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  let user: any = null;

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash withdrawal requests API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request
    let authenticatedRequest: AuthenticatedRequest;
    
    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      logger.warn('Authentication failed for withdrawal requests fetch', {
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
    const status = rawStatus ? rawStatus.toLowerCase() : null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate query parameters
    if (status && !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status parameter' },
        { status: 400 }
      );
    }

    // Check if EcashWithdrawalRequest model is available
    if (!(prisma as any).ecashWithdrawalRequest) {
      // Get available models for debugging
      const availableModels = Object.keys(prisma).filter(key => 
        !key.startsWith('$') && !key.startsWith('_') && typeof (prisma as any)[key] === 'object'
      );
      
      logger.error('EcashWithdrawalRequest model not available in Prisma client', {
        userId: user?.id,
        status,
        attemptedOperation: 'fetch',
        availableModels: availableModels.slice(0, 20), // Log first 20 models
        prismaClientVersion: (prisma as any).$clientVersion || 'unknown',
        nodeEnv: process.env.NODE_ENV
      }, request);

      return NextResponse.json(
        {
          error: 'Ecash withdrawal functionality is not yet available',
          details: 'Prisma client needs to be regenerated. Please run: npx prisma generate',
          code: 'PRISMA_MODEL_NOT_FOUND'
        },
        { status: 503 }
      );
    }

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    // If not admin, show:
    // 1. User's own withdrawal requests (requests they created)
    // 2. Withdrawal requests sent to them (as recipient)
    if (!user?.isAdmin) {
      // Fetch all requests and filter in memory (since recipient info is in remark field)
      // In production, consider adding recipientId field to schema for better performance
      const allRequests = await (prisma as any).ecashWithdrawalRequest.findMany({
        where: status ? { status } : {},
        include: {
          member: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              memberId: true,
              email: true
            }
          },
          processor: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: { createdDate: 'desc' },
      });

      // Filter requests: user's own requests OR requests where user is the recipient
      const filteredRequests = allRequests.filter((req: any) => {
        // User's own requests
        if (req.memberId === user.id) {
          return true;
        }
        
        // Check if user is the recipient by parsing remark field
        if (req.remark) {
          const recipientMatch = req.remark.match(/\[RECIPIENT:(.+?)\]/);
          if (recipientMatch) {
            try {
              const recipientInfo = JSON.parse(recipientMatch[1]);
              if (recipientInfo.recipientId === user.id) {
                return true;
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }
        
        return false;
      });

      // Apply pagination
      const paginatedRequests = filteredRequests.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: paginatedRequests,
        pagination: {
          total: filteredRequests.length,
          limit,
          offset,
          hasNext: offset + limit < filteredRequests.length,
          hasPrev: offset > 0,
        },
      });
    }

    const withdrawalRequests = await (prisma as any).ecashWithdrawalRequest.findMany({
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
        },
        processor: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: { createdDate: 'desc' },
      take: limit,
      skip: offset
    });

    // Enrich requests with recipient information
    const enrichedRequests = await Promise.all(
      withdrawalRequests.map(async (req: any) => {
        // Parse recipient info from remark
        if (req.remark) {
          const recipientMatch = req.remark.match(/\[RECIPIENT:(.+?)\]/);
          if (recipientMatch) {
            try {
              const recipientInfo = JSON.parse(recipientMatch[1]);
              if (recipientInfo.recipientId) {
                // Fetch recipient details
                const recipient = await prisma.user.findUnique({
                  where: { id: recipientInfo.recipientId },
                  select: {
                    id: true,
                    fullName: true,
                    memberId: true
                  }
                });
                
                if (recipient) {
                  req.recipient = {
                    id: recipient.id,
                    fullName: recipient.fullName || `${recipient.memberId}`,
                    memberId: recipient.memberId
                  };
                  req.recipientType = recipientInfo.recipientType;
                }
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }
        return req;
      })
    );

    const total = await (prisma as any).ecashWithdrawalRequest.count({ where: whereClause });

    logger.info('Ecash withdrawal requests fetched', {
      userId: user?.id,
      count: enrichedRequests.length,
      status,
      isAdmin: user?.isAdmin
    }, request);

    return NextResponse.json({
      success: true,
      data: enrichedRequests,
      pagination: {
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Ecash withdrawal requests API error', {
      error: errorMessage,
      stack: errorStack,
      ip: request.headers.get('x-forwarded-for'),
      userId: user?.id,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to access this resource'
        },
        { status: 401 }
      );
    }

    // Return more specific error message
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: isDevelopment ? errorMessage : 'An error occurred while fetching withdrawal requests',
        ...(isDevelopment && { details: errorStack })
      },
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
      
      logger.warn('Authentication failed for withdrawal request', {
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
      keyGenerator: () => `ecash-withdrawal:${user.id}` // Rate limit per user, not IP
    });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash withdrawal creation', {
        userId: user.id,
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }
    const body = await request.json();
    const { amount, remark, bankAccount, bankName, accountName, recipientId } = body;

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Check user's E-Cash balance (do NOT deduct - only check)
    // Also get user details for member name
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        id: true,
        eCashBalance: true,
        fullName: true, 
        email: true, 
        firstName: true, 
        surname: true 
      }
    });

    if (!dbUser) {
      logger.error('User not found in database', { userId: user.id }, request);
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    const balance = dbUser.eCashBalance || 0;

    if (amount > balance) {
      return NextResponse.json(
        { error: 'Insufficient balance. Available balance: ' + balance.toFixed(2) },
        { status: 400 }
      );
    }

    // Check minimum withdrawal amount
    if (amount < 10) {
      return NextResponse.json(
        { error: 'Minimum withdrawal amount is $10' },
        { status: 400 }
      );
    }

    // Validate recipient ID is required
    if (!recipientId) {
      return NextResponse.json(
        { error: 'Recipient ID is required' },
        { status: 400 }
      );
    }

    // Bank account details are optional - no validation needed

    // Check if model is available
    if (!(prisma as any).ecashWithdrawalRequest) {
      const availableModels = Object.keys(prisma).filter(key => 
        !key.startsWith('$') && !key.startsWith('_') && typeof (prisma as any)[key] === 'object'
      );
      
      logger.error('EcashWithdrawalRequest model not available', {
        userId: user.id,
        amount,
        availableModels: availableModels.slice(0, 20),
        prismaClientVersion: (prisma as any).$clientVersion || 'unknown',
        nodeEnv: process.env.NODE_ENV
      }, request);

      return NextResponse.json(
        { 
          error: 'Ecash withdrawal functionality is not yet available',
          details: 'Prisma client needs to be regenerated. Please run: npx prisma generate',
          code: 'PRISMA_MODEL_NOT_FOUND'
        },
        { status: 503 }
      );
    }

    const memberName = dbUser.fullName || 
                      (dbUser.firstName && dbUser.surname ? `${dbUser.firstName} ${dbUser.surname}` : null) ||
                      dbUser.email || 
                      'Unknown User';

    // Create withdrawal request
    let withdrawalRequest;
    try {
      // Prepare withdrawal request data
      // Store recipientId in remark as JSON if provided
      let finalRemark = remark || '';
      if (recipientId) {
        const recipientInfo = JSON.stringify({ recipientId });
        finalRemark = finalRemark 
          ? `${finalRemark}\n[RECIPIENT:${recipientInfo}]`
          : `[RECIPIENT:${recipientInfo}]`;
      }

      const withdrawalData: any = {
        memberId: user.id,
        memberName: memberName,
        amount,
        remark: finalRemark,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        accountName: accountName || null,
        status: 'pending'
      };

      withdrawalRequest = await (prisma as any).ecashWithdrawalRequest.create({
        data: withdrawalData,
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

      // Verify withdrawal request was created successfully
      if (!withdrawalRequest || !withdrawalRequest.id) {
        logger.error('Withdrawal request created but missing ID', {
          userId: user.id,
          amount
        }, request);
        throw new Error('Failed to create withdrawal request - no ID returned');
      }
    } catch (dbError: any) {
      // Handle database errors
      const errorMsg = dbError.message || String(dbError);
      
      logger.error('Database error creating withdrawal request', {
        error: errorMsg,
        userId: user.id,
        amount,
        stack: dbError.stack
      }, request);
      
      if (errorMsg.includes('does not exist') || errorMsg.includes('Unknown model')) {
        return NextResponse.json(
          { 
            error: 'Database table not found',
            message: 'The ecash_withdrawal_requests table does not exist. Please contact administrator.'
          },
          { status: 503 }
        );
      }
      
      // Re-throw other database errors to be caught by outer catch block
      throw dbError;
    }

    // Trigger notification to admins
    try {
      const { triggerEcashWithdrawalRequestNotification } = await import('@/services/notification-service');
      await triggerEcashWithdrawalRequestNotification({
        id: withdrawalRequest.id,
        memberId: user.id,
        memberName: memberName,
        amount
      }).catch(() => {
        // Notification failure shouldn't break the request
      });
    } catch (notifError) {
      logger.warn('Failed to send ecash withdrawal notification', {
        requestId: withdrawalRequest.id,
        error: notifError instanceof Error ? notifError.message : 'Unknown error'
      }, request);
    }

    logger.info('E-cash withdrawal request created', {
      userId: user.id,
      requestId: withdrawalRequest.id,
      amount,
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json({
      success: true,
      data: withdrawalRequest,
      message: 'E-cash withdrawal request submitted successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('E-cash withdrawal creation error', {
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
        error: 'Failed to create e-cash withdrawal request',
        message: isDevelopment ? errorMessage : 'An error occurred while creating the withdrawal request',
        ...(isDevelopment && { details: errorStack })
      },
      { status: 500 }
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

    // Authenticate request - allow admin OR recipient to approve
    let authenticatedRequest: AuthenticatedRequest;
    
    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      logger.warn('Authentication failed for withdrawal request update', {
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
    const body = await request.json();
    const { requestId, status, rejectionReason } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, approved, rejected, or completed' },
        { status: 400 }
      );
    }

    // Check if model is available
    if (!(prisma as any).ecashWithdrawalRequest) {
      const availableModels = Object.keys(prisma).filter(key => 
        !key.startsWith('$') && !key.startsWith('_') && typeof (prisma as any)[key] === 'object'
      );
      
      logger.error('EcashWithdrawalRequest model not available in PATCH', {
        userId: user?.id,
        requestId,
        availableModels: availableModels.slice(0, 20),
        prismaClientVersion: (prisma as any).$clientVersion || 'unknown',
        nodeEnv: process.env.NODE_ENV
      }, request);
      
      return NextResponse.json(
        { 
          error: 'Ecash withdrawal functionality is not yet available',
          details: 'Prisma client needs to be regenerated. Please run: npx prisma generate',
          code: 'PRISMA_MODEL_NOT_FOUND'
        },
        { status: 503 }
      );
    }

    // Get the request to validate and process
    const existingRequest = await (prisma as any).ecashWithdrawalRequest.findUnique({
      where: { id: requestId },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberId: true
          }
        }
      }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'E-cash withdrawal request not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to approve/reject this request
    // User can approve if:
    // 1. User is the recipient of the request (request was sent to them) - applies to all users including admins
    // 2. Admins can only approve requests where they are the recipient
    let hasPermission = false;
    
    // Check if user is the recipient by parsing remark field
    if (existingRequest.remark) {
      const recipientMatch = existingRequest.remark.match(/\[RECIPIENT:(.+?)\]/);
      if (recipientMatch) {
        try {
          const recipientInfo = JSON.parse(recipientMatch[1]);
          if (recipientInfo.recipientId === user.id) {
            hasPermission = true;
          }
        } catch (e) {
          // Invalid JSON, user is not recipient
        }
      }
    }

    if (!hasPermission) {
      logger.warn('User attempted to update withdrawal request without permission', {
        userId: user.id,
        requestId,
        isAdmin: user.isAdmin,
        requestMemberId: existingRequest.memberId
      }, request);
      
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'You do not have permission to approve/reject this withdrawal request. Only admins or the recipient can process this request.' 
        },
        { status: 403 }
      );
    }

    // If rejecting, require rejection reason
    if (status.toLowerCase() === 'rejected' && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting a withdrawal request' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      status: status.toLowerCase(),
      processedBy: user.id,
      processedDate: new Date()
    };

    if (status.toLowerCase() === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    // Use transaction to ensure atomicity
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // If approving, check E-Cash balance first before updating
      if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed') {
        // Check current E-Cash balance
        const userRecord = await tx.user.findUnique({
          where: { id: existingRequest.memberId },
          select: { eCashBalance: true }
        });
        const balance = userRecord?.eCashBalance || 0;

        if (balance < existingRequest.amount) {
          throw new Error('Insufficient E-Cash balance to complete withdrawal');
        }
      }

      // Update the request
      const updated = await (tx as any).ecashWithdrawalRequest.update({
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
          },
          processor: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      // If approved or completed, process the transfer
      if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed') {
        // Parse recipient info from remark field
        let recipientId: string | null = null;
        if (existingRequest.remark) {
          const recipientMatch = existingRequest.remark.match(/\[RECIPIENT:(.+?)\]/);
          if (recipientMatch) {
            try {
              const recipientInfo = JSON.parse(recipientMatch[1]);
              recipientId = recipientInfo.recipientId;
            } catch (e) {
              // Invalid JSON, no recipient
            }
          }
        }

        // Get current E-Cash balance before update
        const userRecord = await tx.user.findUnique({
          where: { id: existingRequest.memberId },
          select: { eCashBalance: true }
        });
        const balanceBefore = userRecord?.eCashBalance || 0;
        const balanceAfter = balanceBefore - existingRequest.amount;

        // Update requester's E-Cash balance (deduct)
        await tx.user.update({
          where: { id: existingRequest.memberId },
          data: {
            eCashBalance: balanceAfter
          }
        });

        // Fetch recipient info if recipientId exists (for transaction description)
        let recipientRecord = null;
        if (recipientId) {
          recipientRecord = await tx.user.findUnique({
            where: { id: recipientId },
            select: { eCashBalance: true, fullName: true, memberId: true }
          });
        }

        // Create E-Cash transaction record for requester (withdrawal)
        const withdrawalSource = recipientId && recipientRecord
          ? `Transfer to ${recipientRecord.fullName || 'Unknown'} (${recipientRecord.memberId || recipientId})`
          : recipientId
          ? `Transfer to ${recipientId}`
          : null;

        await (tx as any).eCashTransaction.create({
          data: {
            userId: existingRequest.memberId,
            type: 'withdrawal',
            source: withdrawalSource,
            amountUsd: -existingRequest.amount // Negative for withdrawal
          }
        });

        // If there's a recipient, transfer the amount to them
        if (recipientId && recipientRecord) {
          // Update recipient's E-Cash balance (add)
          await tx.user.update({
            where: { id: recipientId },
            data: {
              eCashBalance: {
                increment: existingRequest.amount
              }
            }
          });

          // Create E-Cash transaction record for recipient (transfer in)
          const memberName = existingRequest.memberName || existingRequest.member?.fullName || '';
          const memberId = existingRequest.member?.memberId || existingRequest.memberId || '';
          const transferSource = memberId 
            ? `Withdrawal from ${memberName} (${memberId})`
            : `Withdrawal from ${memberName || 'Unknown'}`;
          
          await (tx as any).eCashTransaction.create({
            data: {
              userId: recipientId,
              type: 'transfer',
              source: transferSource,
              amountUsd: existingRequest.amount // Positive for transfer in
            }
          });

          logger.info('E-cash transferred to recipient', {
            requestId,
            recipientId,
            recipientName: recipientRecord.fullName || recipientRecord.memberId,
            amount: existingRequest.amount
          });
        } else if (recipientId && !recipientRecord) {
          logger.warn('Recipient not found for withdrawal transfer', {
            requestId,
            recipientId
          });
        }
      }

      return updated;
    });

    if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed') {
      logger.info('E-cash withdrawal approved and balance debited', {
        requestId,
        memberId: existingRequest.memberId,
        amount: existingRequest.amount
      });
    }

    // Notify requester about the status change
    try {
      const isApproved = status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed';
      const notificationTitle = isApproved 
        ? 'E-Cash Withdrawal Request Approved' 
        : 'E-Cash Withdrawal Request Rejected';
      const notificationBody = isApproved
        ? `Your E-Cash withdrawal request for $${existingRequest.amount.toLocaleString()} has been approved. The funds will be processed according to your bank details.`
        : `Your E-Cash withdrawal request for $${existingRequest.amount.toLocaleString()} has been rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : 'Please contact support if you have questions.'}`;

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
            amount: existingRequest.amount,
            status: status.toLowerCase(),
            rejectionReason: rejectionReason || null,
            link: '/e-cash',
          },
          priority: isApproved ? 'medium' : 'high',
        },
      });
    } catch (notifyErr) {
      logger.warn('E-cash withdrawal PATCH notification create failed for requester', { 
        error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr) 
      }, request);
    }

    // Notify recipient if withdrawal was approved and has a recipient
    if ((status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed')) {
      try {
        // Parse recipient info from remark field (use updatedRequest to get latest data)
        let recipientId: string | null = null;
        const remarkToCheck = updatedRequest.remark || existingRequest.remark;
        
        if (remarkToCheck) {
          const recipientMatch = remarkToCheck.match(/\[RECIPIENT:(.+?)\]/);
          if (recipientMatch) {
            try {
              const recipientInfo = JSON.parse(recipientMatch[1]);
              recipientId = recipientInfo.recipientId;
            } catch (e) {
              logger.warn('Failed to parse recipient info from remark', {
                error: e instanceof Error ? e.message : String(e),
                remark: remarkToCheck.substring(0, 100) // Log first 100 chars
              }, request);
            }
          }
        }

        if (recipientId) {
          // Get recipient details for notification
          const recipient = await prisma.user.findUnique({
            where: { id: recipientId },
            select: { id: true, fullName: true, memberId: true }
          });

          if (recipient) {
            const notificationData = {
              memberId: recipientId,
              type: 'in_app' as const,
              category: 'system' as const,
              title: 'E-Cash Transfer Received',
              body: `You have received $${existingRequest.amount.toLocaleString()} from ${existingRequest.memberName || 'a member'}. The withdrawal request has been approved.`,
              data: {
                requestId: requestId,
                senderId: existingRequest.memberId,
                senderName: existingRequest.memberName,
                amount: existingRequest.amount,
                status: 'approved',
                link: '/ecash',
              },
              priority: 'medium' as const,
            };

            await prisma.notification.create({
              data: notificationData,
            });

            logger.info('Notification sent to withdrawal recipient', {
              recipientId,
              recipientName: recipient.fullName || recipient.memberId,
              requestId,
              amount: existingRequest.amount,
              notificationTitle: notificationData.title
            }, request);
          } else {
            logger.warn('Recipient not found for notification', {
              recipientId,
              requestId
            }, request);
          }
        } else {
          logger.debug('No recipient found in withdrawal request', {
            requestId,
            hasRemark: !!remarkToCheck,
            remarkPreview: remarkToCheck ? remarkToCheck.substring(0, 100) : null
          }, request);
        }
      } catch (notifyErr) {
        logger.error('E-cash withdrawal PATCH notification create failed for recipient', { 
          error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
          stack: notifyErr instanceof Error ? notifyErr.stack : undefined,
          requestId
        }, request);
      }
    }

    logger.info('E-cash withdrawal request updated', {
      userId: user.id,
      requestId,
      newStatus: status,
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json(
      {
        success: true,
        data: updatedRequest,
        message: `E-cash withdrawal request ${status.toLowerCase()} successfully`
      });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Handle insufficient balance error specifically
    if (errorMessage.includes('Insufficient balance')) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          message: 'User does not have sufficient E-Cash balance to complete this withdrawal'
        },
        { status: 400 }
      );
    }

    logger.error('E-cash withdrawal update error', {
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
        error: 'Failed to update e-cash withdrawal request',
        message: isDevelopment ? errorMessage : 'An error occurred while updating the request',
        ...(isDevelopment && { details: errorStack })
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;

  try {
    // Authenticate request
    let authenticatedRequest: AuthenticatedRequest;

    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof AuthenticationError
        ? authError.message
        : 'Authentication required';

      logger.warn('Authentication failed for withdrawal request deletion', {
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

    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      keyGenerator: () => `ecash-withdrawal-delete:${user.id}`
    });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('id');

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required as query parameter' },
        { status: 400 }
      );
    }

    // Check if model is available
    if (!(prisma as any).ecashWithdrawalRequest) {
      return NextResponse.json(
        {
          error: 'E-cash withdrawal functionality is not yet available',
          details: 'Prisma client needs to be regenerated. Please run: npx prisma generate',
          code: 'PRISMA_MODEL_NOT_FOUND'
        },
        { status: 503 }
      );
    }

    // Find the withdrawal request
    const existingRequest = await (prisma as any).ecashWithdrawalRequest.findUnique({
      where: { id: requestId },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberId: true
          }
        }
      }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'E-cash withdrawal request not found' },
        { status: 404 }
      );
    }

    // Authorization check:
    // 1. Only the requester (memberId) can delete their own pending requests
    // 2. Admin users can delete any pending request
    const isAdmin = user.isAdmin === true;
    const isRequester = existingRequest.memberId === user.id;

    if (!isAdmin && !isRequester) {
      logger.warn('User attempted to delete withdrawal request without permission', {
        userId: user.id,
        requestId,
        isAdmin,
        isRequester,
        requestMemberId: existingRequest.memberId
      }, request);

      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to delete this withdrawal request'
        },
        { status: 403 }
      );
    }

    // Only allow deletion of pending requests
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: `Only pending withdrawal requests can be deleted. Current status: ${existingRequest.status}`
        },
        { status: 400 }
      );
    }

    // Delete the withdrawal request within a transaction
    await prisma.$transaction(async (tx) => {
      await (tx as any).ecashWithdrawalRequest.delete({
        where: { id: requestId }
      });
    });

    const duration = Date.now() - startTime;
    logger.info('E-cash withdrawal request deleted', {
      requestId,
      userId: user.id,
      requesterId: existingRequest.memberId,
      isAdmin,
      duration
    }, request);

    return NextResponse.json({
      success: true,
      message: 'E-cash withdrawal request deleted successfully',
      data: { requestId, deletedAt: new Date().toISOString() }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('E-cash withdrawal deletion error', {
      error: errorMessage,
      stack: errorStack,
      ip: request.headers.get('x-forwarded-for'),
      userId: user?.id
    }, request);

    const isDevelopment = process.env.NODE_ENV === 'development';

    return NextResponse.json(
      {
        error: 'Failed to delete e-cash withdrawal request',
        message: isDevelopment ? errorMessage : 'An error occurred while deleting the request',
        ...(isDevelopment && { details: errorStack })
      },
      { status: 500 }
    );
  }
}

