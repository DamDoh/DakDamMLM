import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { ApiResponseUtil } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

/**
 * GET /api/stockist-bonus
 * Fetch Stockist Bonus records for a user
 * Query params:
 * - userId: Filter by stockist user ID
 * - month: Filter by month (1-12)
 * - year: Filter by year
 * - period: Filter by period string (e.g., "2025-01")
 */
export async function GET(request: NextRequest) {
  try {
    return await requireAuth(async (authenticatedRequest) => {
      const user = authenticatedRequest.user;
      if (!user || !user.id) {
        return ApiResponseUtil.unauthorized('User authentication failed');
      }

      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId') || user.id;
      const month = searchParams.get('month');
      const year = searchParams.get('year');
      const period = searchParams.get('period');

      // Build filter
      const where: any = {
        stockistId: userId,
      };

      if (month) {
        where.month = parseInt(month);
      }

      if (year) {
        where.year = parseInt(year);
      }

      if (period) {
        where.period = period;
      }

      // Fetch stockist bonus records
      const bonuses = await (prisma as any).stockistBonus.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate total bonus amount
      const totalBonus = bonuses.reduce((sum: number, bonus: any) => sum + bonus.bonusAmount, 0);

      logger.info('Stockist bonuses fetched', {
        userId,
        count: bonuses.length,
        totalBonus,
      }, request);

      return ApiResponseUtil.success({
        bonuses,
        totalBonus,
        count: bonuses.length,
      });
    })(request);
  } catch (error: any) {
    logger.error('Failed to fetch stockist bonuses', {
      error: error.message,
      stack: error.stack,
    }, request);
    return ApiResponseUtil.error('Failed to fetch stockist bonuses');
  }
}

/**
 * POST /api/stockist-bonus
 * Create a new Stockist Bonus record (internal use only - called during stock transfer)
 */
export async function POST(request: NextRequest) {
  try {
    return await requireAuth(async (authenticatedRequest) => {
      const user = authenticatedRequest.user;
      if (!user || !user.id) {
        return ApiResponseUtil.unauthorized('User authentication failed');
      }

      // Only admins can create stockist bonus records
      if (!user.isAdmin) {
        return ApiResponseUtil.forbidden('Only admins can create stockist bonus records');
      }

      const body = await request.json();
      const { stockistId, memberId, transferredPV, bonusRate, bonusAmount, stockistLevel } = body;

      if (!stockistId || !memberId || !transferredPV || bonusRate === undefined || !bonusAmount || !stockistLevel) {
        return ApiResponseUtil.error('Missing required fields', 400);
      }

      // Get current date for period tracking
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const year = now.getFullYear();
      const period = `${year}-${month.toString().padStart(2, '0')}`;

      // Create stockist bonus record
      const bonus = await (prisma as any).stockistBonus.create({
        data: {
          stockistId,
          memberId,
          transferredPV,
          bonusRate,
          bonusAmount,
          stockistLevel,
          month,
          year,
          period,
          companyId: null,
        },
      });

      // Also create a commission record for the stockist
      await prisma.commission.create({
        data: {
          userId: stockistId,
          type: 'Stockist Bonus',
          amount: bonusAmount,
          status: 'Approved',
          companyId: null,
        },
      });

      logger.info('Stockist bonus created', {
        bonusId: bonus.id,
        stockistId,
        memberId,
        bonusAmount,
        stockistLevel,
      }, request);

      return NextResponse.json({
        success: true,
        data: bonus,
        message: 'Stockist bonus created successfully',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
        }
      }, { status: 201 });
    })(request);
  } catch (error: any) {
    logger.error('Failed to create stockist bonus', {
      error: error.message,
      stack: error.stack,
    }, request);
    return ApiResponseUtil.error('Failed to create stockist bonus');
  }
}
