import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import * as inventoryService from '@/services/inventory-service';
import { scheduleCommissionCalculation } from '@/services/commission-queue';
import { shouldUpdateRank, type Rank } from '@/lib/rank';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 20 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for order creation', {
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
    const { items, totalAmount, companyId, idempotencyKey } = body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ApiResponseUtil.validationError([{
        field: 'items',
        message: 'Order must contain at least one item'
      }]);
    }

    // IDEMPOTENCY FIX: Check if order with this key already exists (prevents duplicate orders)
    // NOTE: This requires database migration to add idempotencyKey field
    if (idempotencyKey) {
      try {
        const existingOrder = await prisma.order.findFirst({
          where: {
            // @ts-ignore - idempotencyKey field needs migration
            idempotencyKey: idempotencyKey
          },
          include: { items: true }
        });

        if (existingOrder) {
          logger.info('Duplicate order request detected (idempotency)', {
            userId: user.id,
            orderId: existingOrder.orderId,
            idempotencyKey
          });

          // Calculate PV from items (fix TypeScript error)
          // @ts-ignore - items relation needs proper typing
          const pvAdded = existingOrder.items?.reduce((sum: number, item: any) => sum + (item.pv * item.quantity), 0) || 0;

          // Return existing order instead of creating duplicate
          return ApiResponseUtil.success({
            order: existingOrder,
            pvAdded,
            commissionsTriggered: false,
            duplicate: true
          }, 'Order already exists (returned existing order)');
        }
      } catch (error) {
        // If idempotencyKey field doesn't exist yet, continue with order creation
        logger.warn('Idempotency check failed - field may not exist yet:', { error: String(error) });
      }
    }

    // Validate and calculate totals
    let calculatedTotal = 0;
    let totalPV = 0;
    const validatedItems: any[] = [];

    // CRITICAL FIX: Validate products and reserve stock BEFORE creating order
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: 'Each item must have productId and positive quantity'
        }]);
      }

      // Verify product exists and get details
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Product ${item.productId} not found`
        }]);
      }

      if (!product.isActive) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Product ${product.name} is not available`
        }]);
      }

      calculatedTotal += product.price * item.quantity;
      // FIX: Handle null/undefined PV values - default to 0 if not set
      const productPV = product.pv ?? 0;
      totalPV += productPV * item.quantity;
      
      // Store validated item data
      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        pv: productPV,
        name: product.name
      });
    }

    // Validate total matches
    if (totalAmount && Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return ApiResponseUtil.validationError([{
        field: 'totalAmount',
        message: `Total amount mismatch. Expected: ${calculatedTotal}, Received: ${totalAmount}`
      }]);
    }

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${user.id.slice(-6)}`;

    // CRITICAL FIX: Reserve stock atomically BEFORE creating order
    // This prevents overselling in concurrent scenarios
    const reservationResults: { productId: string; reserved: boolean }[] = [];
    
    for (const item of validatedItems) {
      const reserved = await inventoryService.reserveStock(
        item.productId,
        item.quantity,
        orderId,
        user.id,
        companyId
      );
      
      reservationResults.push({
        productId: item.productId,
        reserved
      });
      
      if (!reserved) {
        // Reservation failed - release any previously reserved stock
        for (const prev of reservationResults.slice(0, -1)) {
          if (prev.reserved) {
            await inventoryService.releaseStock(
              prev.productId,
              validatedItems.find(v => v.productId === prev.productId)?.quantity || 0,
              orderId,
              user.id,
              companyId
            );
          }
        }
        
        const product = validatedItems.find(v => v.productId === item.productId);
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Unable to reserve ${product?.name}. Product may have been sold. Please try again.`
        }]);
      }
    }

    logger.info('Stock reserved for order', {
      orderId,
      itemCount: validatedItems.length,
      userId: user.id
    });

    // Create order and update PV in transaction
    // Note: Stock already reserved above, so inventory is already updated
    const order = await prisma.$transaction(async (tx) => {
      // Create order with idempotency key
      const newOrder = await tx.order.create({
        data: {
          orderId,
          userId: user.id,
          status: 'Pending',
          itemCount: validatedItems.length,
          amount: calculatedTotal,
          totalAmount: calculatedTotal,
          companyId: companyId || null,
          // @ts-ignore - idempotencyKey field needs migration
          idempotencyKey: idempotencyKey || null, // Store for duplicate detection
          items: {
            create: validatedItems.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              pv: item.pv
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Stock already reserved by inventoryService.reserveStock() above
      // No need to update product quantities here

      // Update user PV - in same transaction
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          pv: {
            increment: totalPV
          },
          pvDate: new Date()
        },
        select: {
          id: true,
          pv: true,
          rank: true,
          memberId: true
        }
      });

      // Check if rank should be updated based on new PV
      const rankUpdateCheck = shouldUpdateRank(updatedUser.rank as Rank, updatedUser.pv);

      if (rankUpdateCheck.shouldUpdate) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            rank: rankUpdateCheck.newRank
          }
        });

        logger.info('Rank automatically updated', {
          userId: user.id,
          memberId: updatedUser.memberId || 'N/A',
          oldRank: rankUpdateCheck.currentRank,
          newRank: rankUpdateCheck.newRank,
          pv: updatedUser.pv,
          reason: rankUpdateCheck.reason
        });
      } else {
        // Log why rank wasn't updated (for debugging/monitoring)
        logger.debug('Rank update check', {
          userId: user.id,
          currentRank: rankUpdateCheck.currentRank,
          pvBasedRank: rankUpdateCheck.pvBasedRank,
          pv: updatedUser.pv,
          reason: rankUpdateCheck.reason,
          shouldUpdate: false
        });
      }

      return newOrder;
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000
    });

    logger.info('Order created successfully', {
      userId: user.id,
      orderId: order.orderId,
      itemCount: validatedItems.length,
      totalAmount: calculatedTotal,
      totalPV,
      duration: Date.now() - startTime
    }, request);

    // PERFORMANCE FIX: Use queue instead of immediate trigger
    // This prevents database overload from concurrent orders
    await scheduleCommissionCalculation(`order:${order.orderId}`, {
      orderId: order.orderId,
      userId: user.id,
      totalPV
    });

    return ApiResponseUtil.success({
      order,
      pvAdded: totalPV,
      commissionsTriggered: true
    }, 'Order created successfully');

  } catch (error) {
    logger.error('Order creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 60 });
    if (!rateLimitResult.success) {
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
    const status = searchParams.get('status');

    // Users see only their orders unless admin
    const where: any = { userId: user.id };
    
    if (status) {
      where.status = status;
    }

    // Admins can query other users' orders
    const queriedUserId = searchParams.get('userId');
    if (user.isAdmin && queriedUserId) {
      where.userId = queriedUserId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.order.count({ where });

    logger.info('Orders fetched', {
      userId: user.id,
      count: orders.length,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.paginated(
      orders,
      total,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    logger.error('Orders fetch error', {
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
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 30 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate request - require admin for status changes
    const authenticatedRequest = await requireAuth(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return ApiResponseUtil.validationError([
        { field: 'orderId', message: 'Order ID is required' },
        { field: 'status', message: 'Status is required' }
      ]);
    }

    // Validate status
    const validStatuses = ['Pending', 'Processing', 'Fulfilled', 'Declined', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return ApiResponseUtil.validationError([{
        field: 'status',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }]);
    }

    // Get existing order
    const existingOrder = await prisma.order.findUnique({
      where: { orderId },
      include: { items: true }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Non-admins can only cancel their own pending orders
    if (!user.isAdmin) {
      if (existingOrder.userId !== user.id) {
        return NextResponse.json(
          { error: 'You can only modify your own orders' },
          { status: 403 }
        );
      }
      if (status !== 'Cancelled' || existingOrder.status !== 'Pending') {
        return NextResponse.json(
          { error: 'You can only cancel pending orders' },
          { status: 403 }
        );
      }
    }

    // FIXED: Update order status and restore stock in single transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { orderId },
        data: { status },
        include: { items: true }
      });

      // If order declined or cancelled, restore stock atomically
      if ((status === 'Declined' || status === 'Cancelled') && existingOrder.status === 'Pending') {
        await Promise.all(
          existingOrder.items.map((item: any) =>
            tx.product.update({
              where: { id: item.productId },
              data: {
                qty: {
                  increment: item.quantity
                }
              }
            })
          )
        );
      }

      return updated;
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000
    });

    logger.info('Order status updated', {
      userId: user.id,
      orderId,
      oldStatus: existingOrder.status,
      newStatus: status,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(updatedOrder, 'Order updated successfully');

  } catch (error) {
    logger.error('Order update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}