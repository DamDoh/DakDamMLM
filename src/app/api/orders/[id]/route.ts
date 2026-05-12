import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate request and execute handler with authenticated user
    return requireAuth(async (req) => {
      const user = req.user!;
      const { id } = await params;
      const orderId = id;

      if (!orderId) {
        return ApiResponseUtil.validationError([{
          field: 'id',
          message: 'Order ID is required'
        }]);
      }

      // Fetch order with items
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: orderId },
            { orderId: orderId }
          ],
          // Users see only their orders unless admin
          ...(!user.isAdmin ? { userId: user.id } : {})
        },
        include: {
          items: true
        }
      });

      if (!order) {
        return ApiResponseUtil.error('Order not found', 404);
      }

      // Fetch user data separately since Order doesn't have user relation
      const orderUser = await prisma.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          firstName: true,
          surname: true,
          memberId: true,
          email: true
        }
      });

      // Fetch product details for each order item
      if (order.items) {
        const productIds = order.items.map(item => item.productId);
        const products = await prisma.product.findMany({
          where: {
            id: {
              in: productIds
            }
          },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            price: true,
            pv: true
          }
        });

        // Map products to items
        const productMap = new Map(products.map(p => [p.id, p]));
        order.items = order.items.map(item => ({
          ...item,
          product: productMap.get(item.productId) || null
        }));
      }

      // Add user data to order object
      const orderWithUser = {
        ...order,
        user: orderUser
      };

      logger.info('Order details fetched', {
        userId: user.id,
        orderId: orderWithUser.id,
        duration: Date.now() - startTime
      }, request);

      return ApiResponseUtil.success(orderWithUser, API_MESSAGES.FETCHED);
    })(request);

  } catch (error) {
    logger.error('Order details fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

