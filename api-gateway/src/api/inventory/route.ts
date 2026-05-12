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
      logger.warn('Rate limit exceeded for inventory API', {
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
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Users can only see their own inventory unless admin
    const queriedUserId = searchParams.get('userId');
    const targetUserId = (user.isAdmin && queriedUserId) ? queriedUserId : user.id;

    // Check if InventoryItem model exists
    if (!(prisma as any).inventoryItem) {
      logger.warn('InventoryItem model not available', {
        userId: user.id
      }, request);

      return NextResponse.json({
        success: true,
        data: [],
        message: 'Inventory feature is not yet available'
      });
    }

    const inventoryItems = await (prisma as any).inventoryItem.findMany({
      where: { userId: targetUserId },
      orderBy: { lastUpdated: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await (prisma as any).inventoryItem.count({
      where: { userId: targetUserId }
    });

    const duration = Date.now() - startTime;
    logger.info('Inventory fetched', {
      userId: user.id,
      targetUserId,
      count: inventoryItems.length,
      duration
    }, request);

    return ApiResponseUtil.paginated(
      inventoryItems,
      total,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    logger.error('Failed to fetch inventory', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}