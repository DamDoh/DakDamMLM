import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, VALIDATION_PATTERNS, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for stock requests API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request - require authentication for all stock request operations
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

    // Validate query parameters using standardized patterns
    const validationErrors = ApiResponseUtil.validateQueryParams(
      { status: status || undefined },
      { status: VALIDATION_PATTERNS.statuses.stockRequest }
    );

    if (validationErrors.length > 0) {
      return ApiResponseUtil.validationError(validationErrors);
    }

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    // If not admin, only show user's own requests
    if (!(authenticatedRequest as any).user?.isAdmin) {
      whereClause.stockistId = (authenticatedRequest as any).user.id;
    }

    // Check if StockRequest model is available (it might not be in older Prisma clients)
    if (!(prisma as any).stockRequest) {
      logger.error('StockRequest model not available in Prisma client', {
        userId: (authenticatedRequest as any).user?.id,
        status,
        attemptedOperation: 'fetch'
      }, request);

      return ApiResponseUtil.serviceUnavailable('Database models are being updated');
    }

    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true,
            storeOwnerLevel: true
          }
        }
      },
      orderBy: { createdDate: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await (prisma as any).stockRequest.count({ where: whereClause });

    logger.info('Stock requests fetched successfully', {
      userId: (authenticatedRequest as any).user?.id,
      count: stockRequests.length,
      status,
      isAdmin: (authenticatedRequest as any).user?.isAdmin,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.paginated(
      stockRequests,
      total,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    logger.error('Stock requests API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return ApiResponseUtil.unauthorized();
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 20 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for stock request creation', {
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
    const { items, stockistLevel } = body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ApiResponseUtil.validationError([{ field: 'items', message: 'Items are required' }]);
    }

    // Calculate total value and item count
    let totalValue = 0;
    let itemCount = 0;

    for (const item of items) {
      if (!item.productId || !item.requestedQuantity || item.requestedQuantity <= 0) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: 'Each item must have productId and positive requestedQuantity'
        }]);
      }
      totalValue += (item.unitPrice || 0) * item.requestedQuantity;
      itemCount += item.requestedQuantity;
    }

    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      return ApiResponseUtil.serviceUnavailable('Stock request functionality is not yet available');
    }

    // Create stock request
    const stockRequest = await (prisma as any).stockRequest.create({
      data: {
        stockistId: user.id,
        stockistName: user.fullName,
        stockistLevel: stockistLevel || 'District',
        status: 'pending',
        totalValue,
        itemCount,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName || 'Unknown Product',
            requestedQuantity: item.requestedQuantity,
            unitPrice: item.unitPrice || 0
          }))
        }
      },
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true
          }
        }
      }
    });

    logger.info('Stock request created', {
      userId: user.id,
      requestId: stockRequest.id,
      itemCount,
      totalValue,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(stockRequest, 'Stock request created successfully');

  } catch (error) {
    logger.error('Stock request creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
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

    // Authenticate request - require admin for updates
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();
    const { requestId, status, approvedQuantities } = body;

    if (!requestId || !status) {
      return ApiResponseUtil.validationError([
        { field: 'requestId', message: 'Request ID is required' },
        { field: 'status', message: 'Status is required' }
      ]);
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return ApiResponseUtil.validationError([
        { field: 'status', message: 'Invalid status value' }
      ]);
    }

    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      return ApiResponseUtil.serviceUnavailable('Stock request functionality is not yet available');
    }

    // Update stock request
    const updateData: any = {
      status,
      processedBy: user.id,
      processedDate: new Date()
    };

    const stockRequest = await (prisma as any).stockRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true
          }
        }
      }
    });

    // Update approved quantities if provided
    if (approvedQuantities && typeof approvedQuantities === 'object') {
      const itemUpdatePromises = Object.entries(approvedQuantities).map(([itemId, quantity]) =>
        (prisma as any).stockRequestItem.update({
          where: { id: itemId },
          data: { approvedQuantity: quantity }
        })
      );
      await Promise.all(itemUpdatePromises);
    }

    logger.info('Stock request updated', {
      userId: user.id,
      requestId,
      newStatus: status,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(stockRequest, 'Stock request updated successfully');

  } catch (error) {
    logger.error('Stock request update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}