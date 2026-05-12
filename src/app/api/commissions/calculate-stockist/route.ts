import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { CommissionService } from '@/services/commission-service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/commissions/calculate-stockist
 * Calculate and create Stockist Bonus for a specific member or all members
 * Admin only endpoint
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and check admin status
    return requireAdmin(async (req) => {
      const user = req.user;
      if (!user) {
        return ApiResponseUtil.unauthorized();
      }

      const body = await request.json().catch(() => ({}));
      const { memberId, memberId: userId } = body as { memberId?: string };

      logger.info('Starting stockist bonus calculation', {
        userId: user.id,
        targetMemberId: userId || 'all'
      }, request);

      const results: Array<{
        memberId: string;
        memberName: string;
        stockistLevel: string | null;
        pv: number;
        calculatedBonus: number;
        created: boolean;
        error?: string;
      }> = [];

      if (userId) {
        // Calculate for specific member
        try {
          const member = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              fullName: true,
              memberId: true,
              pv: true,
              storeOwnerLevel: true,
              active: true,
              companyId: true
            }
          });

          if (!member) {
            return ApiResponseUtil.error('Member not found');
          }

          const stockistBonusAmount = await CommissionService.calculateStockistBonus(member.id);

          if (stockistBonusAmount > 0) {
            // Check if stockist bonus already exists for current month
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            const existingStockistBonus = await prisma.commission.findFirst({
              where: {
                userId: member.id,
                type: 'Stockist Bonus',
                date: {
                  gte: startDate,
                  lte: endDate
                },
                status: { in: ['Paid', 'Pending'] }
              }
            });

            if (!existingStockistBonus) {
              // Create stockist bonus commission
              const stockistCommission = await CommissionService.createCommission(
                member.id,
                stockistBonusAmount,
                'Stockist Bonus',
                undefined,
                member.companyId || undefined
              );

              // Pay commission immediately
              await CommissionService.payCommission(stockistCommission.id);

              results.push({
                memberId: member.id,
                memberName: member.fullName || member.memberId || 'Unknown',
                stockistLevel: member.storeOwnerLevel,
                pv: member.pv || 0,
                calculatedBonus: stockistBonusAmount,
                created: true
              });
            } else {
              results.push({
                memberId: member.id,
                memberName: member.fullName || member.memberId || 'Unknown',
                stockistLevel: member.storeOwnerLevel,
                pv: member.pv || 0,
                calculatedBonus: stockistBonusAmount,
                created: false,
                error: 'Commission already exists for this month'
              });
            }
          } else {
            results.push({
              memberId: member.id,
              memberName: member.fullName || member.memberId || 'Unknown',
              stockistLevel: member.storeOwnerLevel,
              pv: member.pv || 0,
              calculatedBonus: 0,
              created: false,
              error: 'No stockist bonus calculated (check stockist level and PV)'
            });
          }
        } catch (error: any) {
          return ApiResponseUtil.error(error.message || 'Failed to calculate stockist bonus');
        }
      } else {
        // Calculate for all members with stockist levels (no PV requirement)
        const members = await prisma.user.findMany({
          where: {
            active: true,
            storeOwnerLevel: { not: null }
          },
          select: {
            id: true,
            fullName: true,
            memberId: true,
            pv: true,
            storeOwnerLevel: true,
            companyId: true
          }
        });

        for (const member of members) {
          try {
            const stockistBonusAmount = await CommissionService.calculateStockistBonus(member.id);

            if (stockistBonusAmount > 0) {
              // Check if stockist bonus already exists for current month
              const now = new Date();
              const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

              const existingStockistBonus = await prisma.commission.findFirst({
                where: {
                  userId: member.id,
                  type: 'Stockist Bonus',
                  date: {
                    gte: startDate,
                    lte: endDate
                  },
                  status: { in: ['Paid', 'Pending'] }
                }
              });

              if (!existingStockistBonus) {
                // Create stockist bonus commission
                const stockistCommission = await CommissionService.createCommission(
                  member.id,
                  stockistBonusAmount,
                  'Stockist Bonus',
                  undefined,
                  member.companyId || undefined
                );

                // Pay commission immediately
                await CommissionService.payCommission(stockistCommission.id);

                results.push({
                  memberId: member.id,
                  memberName: member.fullName || member.memberId || 'Unknown',
                  stockistLevel: member.storeOwnerLevel,
                  pv: member.pv || 0,
                  calculatedBonus: stockistBonusAmount,
                  created: true
                });
              } else {
                results.push({
                  memberId: member.id,
                  memberName: member.fullName || member.memberId || 'Unknown',
                  stockistLevel: member.storeOwnerLevel,
                  pv: member.pv || 0,
                  calculatedBonus: stockistBonusAmount,
                  created: false,
                  error: 'Already exists'
                });
              }
            } else {
              results.push({
                memberId: member.id,
                memberName: member.fullName || member.memberId || 'Unknown',
                stockistLevel: member.storeOwnerLevel,
                pv: member.pv || 0,
                calculatedBonus: 0,
                created: false,
                error: 'No bonus calculated'
              });
            }
          } catch (error: any) {
            results.push({
              memberId: member.id,
              memberName: member.fullName || member.memberId || 'Unknown',
              stockistLevel: member.storeOwnerLevel,
              pv: member.pv || 0,
              calculatedBonus: 0,
              created: false,
              error: error.message || 'Calculation failed'
            });
          }
        }
      }

      const createdCount = results.filter(r => r.created).length;
      const totalBonus = results.filter(r => r.created).reduce((sum, r) => sum + r.calculatedBonus, 0);

      const duration = Date.now() - startTime;
      logger.info('Stockist bonus calculation completed', {
        userId: user.id,
        processed: results.length,
        created: createdCount,
        totalBonus,
        duration
      }, request);

      return ApiResponseUtil.success({
        processed: results.length,
        created: createdCount,
        totalBonus: Math.round(totalBonus * 100) / 100,
        results: results.slice(0, 50) // Limit to first 50 for response size
      }, `Processed ${results.length} members, created ${createdCount} stockist bonus commissions`);

    })(request);

  } catch (error) {
    logger.error('Failed to calculate stockist bonus', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

