import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { authenticateRequest, AuthenticationError } from '@/lib/auth-middleware';

/**
 * POST /api/e-cash/backfill
 * Backfill E-Cash balance from existing paid commissions
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for E-Cash backfill', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request
    let user: any = null;
    try {
      const authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          message
        },
        { status: 401 }
      );
    }

    if (!user || !user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          message: 'User authentication failed. Please log in again.'
        },
        { status: 401 }
      );
    }

    // Import backfill function
    const { backfillECashFromCommissions } = await import('@/services/e-cash-service');
    
    // Backfill E-Cash balance
    const result = await backfillECashFromCommissions(user.id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message || 'Failed to backfill E-Cash balance'
        },
        { status: 500 }
      );
    }

    logger.info('E-Cash backfill completed', {
      userId: user.id,
      duration: Date.now() - startTime,
      transactionsCreated: result.transactionsCreated,
      newBalance: result.newBalance
    }, request);

    return NextResponse.json({
      success: true,
      data: {
        totalCommissions: result.totalCommissions,
        transactionsCreated: result.transactionsCreated,
        newBalance: result.newBalance
      },
      message: `Successfully backfilled E-Cash balance. ${result.transactionsCreated} transactions created.`
    });
  } catch (error) {
    logger.error('E-Cash backfill error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to backfill E-Cash balance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

