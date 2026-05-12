import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for sponsors API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereClause: any = {
      active: true,
      isAdmin: false // Only non-admin members can be sponsors
    };

    if (companyId) {
      whereClause.companyId = companyId;
    }

    const members = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        surname: true,
        fullName: true,
        memberId: true,
        isAdmin: true,
        rank: true,
        accountType: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.user.count({ where: whereClause });

    const duration = Date.now() - startTime;
    logger.info('Sponsors fetched', {
      count: members.length,
      companyId,
      duration
    }, request);

    return ApiResponseUtil.paginated(
      members,
      total,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to load sponsors', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}