/**
 * POST /api/admin/backfill-teamsize
 * Backfill teamSize for all existing users
 * Admin only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { PVMatchingService } from '@/services/pv-matching-service';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    return await requireAuth(async (req: AuthenticatedRequest) => {
      const user = req.user!;

      // Only admins can run this
      if (!user.isAdmin) {
        return ApiResponseUtil.forbidden('Only admins can backfill teamSize');
      }

      logger.info('Starting teamSize backfill for all users', {}, request);

      // Get all active, non-deleted users
      const allUsers = await prisma.user.findMany({
        where: {
          deleted: false,
          active: true
        },
        select: {
          id: true,
          email: true,
          memberId: true
        }
      });

      logger.info(`Found ${allUsers.length} users to process`, {}, request);

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ userId: string; error: string }> = [];

      // Process users in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < allUsers.length; i += batchSize) {
        const batch = allUsers.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (user) => {
            try {
              await PVMatchingService.updateTeamSize(user.id);
              successCount++;
              
              if (successCount % 100 === 0) {
                logger.info(`Processed ${successCount} users...`, {}, request);
              }
            } catch (error) {
              errorCount++;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push({ userId: user.id, error: errorMessage });
              logger.error('Error updating teamSize for user', {
                userId: user.id,
                error: errorMessage
              });
            }
          })
        );
      }

      logger.info('TeamSize backfill completed', {
        total: allUsers.length,
        success: successCount,
        errors: errorCount
      }, request);

      return NextResponse.json({
        success: true,
        message: 'TeamSize backfill completed',
        stats: {
          total: allUsers.length,
          success: successCount,
          errors: errorCount
        },
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // Return first 10 errors
      }, { status: 200 });
    })(request);
  } catch (error) {
    logger.error('Failed to backfill teamSize', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error('Failed to backfill teamSize');
  }
}

