import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 60 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for commissions API', {
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
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    // Build where clause - users can only see their own commissions unless admin
    const where: any = { userId: user.id };
    
    if (status) {
      where.status = status;
    }

    // Admins can query other users' commissions
    const queriedUserId = searchParams.get('userId');
    if (user.isAdmin && queriedUserId) {
      where.userId = queriedUserId;
    }

    const commissions = await prisma.commission.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.commission.count({ where });

    // Transform Prisma data to match expected types
    const transformedCommissions = commissions.map(c => ({
      id: c.id,
      userId: c.userId,
      date: c.date.toISOString(),
      type: c.type,
      status: c.status as 'Paid' | 'Pending' | 'Failed',
      amount: c.amount
    }));

    const duration = Date.now() - startTime;
    logger.info('Commissions fetched', {
      userId: user.id,
      count: transformedCommissions.length,
      duration
    }, request);

    return ApiResponseUtil.paginated(
      transformedCommissions,
      total,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    logger.error('Failed to fetch commissions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}