import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { withRateLimit, createAdminRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { CommissionService } from '@/services/commission-service';
import { prisma } from '@/lib/database';

/**
 * POST /api/commissions/calculate
 * Calculate binary bonus commissions for all eligible users
 * Admin only endpoint
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const handler = withRateLimit(
      requireAdmin(async (req) => {
        const user = req.user;
        if (!user) {
          return ApiResponseUtil.unauthorized();
        }

        const body = await request.json().catch(() => ({}));
        const companyId = typeof body.companyId === 'string' ? body.companyId.trim() || undefined : undefined;

        if (companyId) {
          const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true }
          });
          if (!company) {
            logger.warn('Admin requested commission calculation for invalid company', {
              userId: user.id,
              companyId
            }, request);
            return ApiResponseUtil.error('Invalid companyId provided', 400);
          }
        }

        logger.info('Starting commission cycle calculation', {
          userId: user.id,
          companyId: companyId || 'all'
        }, request);

        const result = await CommissionService.runCommissionCycle(companyId);

        const duration = Date.now() - startTime;
        logger.info('Commission cycle completed', {
          userId: user.id,
          processed: result.processed,
          totalAmount: result.totalAmount,
          errors: result.errors.length,
          duration,
          errorDetails: result.errors.slice(0, 10)
        }, request);

        return ApiResponseUtil.success({
          processed: result.processed,
          totalAmount: result.totalAmount,
          errors: result.errors,
          errorCount: result.errors.length,
          message: result.processed > 0
            ? `Successfully calculated commissions for ${result.processed} users. Total amount: ${result.totalAmount.toFixed(2)}`
            : `No commissions calculated. Check errors: ${result.errors.length > 0 ? result.errors.slice(0, 3).join('; ') : 'No errors but no commissions found. Members may not meet qualification requirements.'}`
        }, 'Commission cycle completed');
      }),
      createAdminRateLimit({ windowMs: 60 * 1000, maxRequests: 1000 })
    );

    return await handler(request);

  } catch (error) {
    logger.error('Failed to calculate commissions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

