import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for balance checks
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 30 }); // 30 per minute
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash balance API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request using bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch user's paid commissions
    const userCommissions = await prisma.commission.findMany({
      where: {
        userId: user.id,
        status: 'Paid'
      }
    });

    // Calculate total balance
    const balance = userCommissions.reduce((acc, curr) => acc + curr.amount, 0);

    const duration = Date.now() - startTime;
    logger.info('E-cash balance retrieved', {
      userId: user.id,
      balance,
      commissionCount: userCommissions.length,
      duration
    }, request);

    return NextResponse.json({
      success: true,
      data: {
        balance,
        commissionCount: userCommissions.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('E-cash balance API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch e-cash balance' },
      { status: 500 }
    );
  }
}