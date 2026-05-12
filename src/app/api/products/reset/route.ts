import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { resetAllProducts } from '@/services/product-service';

/**
 * POST /api/products/reset
 * Reset all products (delete all and add new ones)
 * Admin only
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for product reset', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;

    // Reset all products
    await resetAllProducts();

    const duration = Date.now() - startTime;
    logger.info('Products reset successfully', {
      userId: user.id,
      duration
    }, request);

    return NextResponse.json({
      success: true,
      message: 'All products have been reset successfully'
    });

  } catch (error) {
    logger.error('Product reset error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset products' 
      },
      { status: 500 }
    );
  }
}

