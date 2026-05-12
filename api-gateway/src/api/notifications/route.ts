import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { authenticateRequest } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 60 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for notifications API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request and extract user
    const authenticatedRequest = await authenticateRequest(request);
    const user = authenticatedRequest.user!;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const isRead = searchParams.get('isRead');

    // Users can only see their own notifications
    const where: any = { memberId: user.id };
    
    if (isRead !== null) {
      where.isRead = isRead === 'true';
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdDate: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.notification.count({ where });
    const unreadCount = await prisma.notification.count({
      where: { memberId: user.id, isRead: false }
    });

    const duration = Date.now() - startTime;
    logger.info('Notifications fetched', {
      userId: user.id,
      count: notifications.length,
      unreadCount,
      duration
    }, request);

    return NextResponse.json(
      {
        success: true,
        data: notifications,
        pagination: {
          total,
          limit,
          offset,
          hasNext: offset + limit < total,
          hasPrev: offset > 0
        },
        unreadCount
      },
      { status: 200 }
    );

  } catch (error) {
    logger.error('Failed to fetch notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}