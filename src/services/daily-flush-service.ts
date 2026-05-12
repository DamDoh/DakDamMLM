/**
 * Daily Flush Service - Safety Rule #1: Flush-out (Burn-out) Policy
 * 
 * REQUIREMENT:
 * - Any points or matched pairs that exceed the daily matching limit must be 
 *   automatically deleted (flushed out) at 1:00 AM every day
 * - The system must NOT store excess points beyond the daily limit to protect 
 *   the company from financial loss
 * 
 * IMPLEMENTATION:
 * - Runs at 1:00 AM daily via cron job
 * - Calculates daily limit for each user based on rank
 * - Flushes excess waiting PV that exceeds daily matching capacity
 * - Logs all flush operations for audit
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { PVMatchingService } from './pv-matching-service';

// Daily Match: max payout per day by rank ($). Used to calculate max PV that can be matched
const BONUS_CONFIG: Record<string, { dailyCapAmount: number; label: string }> = {
  Bronze: { dailyCapAmount: 8, label: 'Daily Match' },
  Silver: { dailyCapAmount: 80, label: 'Daily Match' },
  Gold: { dailyCapAmount: 320, label: 'Daily Match' },
  Diamond: { dailyCapAmount: 640, label: 'Daily Match' },
  Manager: { dailyCapAmount: 800, label: 'Daily Match' },
  Director: { dailyCapAmount: 928, label: 'Daily Match' },
  President: { dailyCapAmount: 1120, label: 'Daily Match' },
  'Double President': { dailyCapAmount: 1600, label: 'Daily Match' },
};

const DAILY_MATCH_RATE = 0.08; // 8% commission rate

export interface FlushResult {
  userId: string;
  memberId: string | null;
  rank: string;
  leftWaitingPVBefore: number;
  rightWaitingPVBefore: number;
  leftWaitingPVAfter: number;
  rightWaitingPVAfter: number;
  leftFlushed: number;
  rightFlushed: number;
  dailyCapAmount: number;
  maxMatchablePV: number;
}

/**
 * Calculate maximum PV that can be matched in a day based on daily cap
 * Formula: maxMatchablePV = dailyCapAmount / DAILY_MATCH_RATE
 */
function calculateMaxMatchablePV(dailyCapAmount: number): number {
  return Math.floor(dailyCapAmount / DAILY_MATCH_RATE);
}

/**
 * Flush excess waiting PV for a single user
 * Excess = waiting PV that exceeds the maximum matchable PV for their rank
 */
async function flushUserExcessPV(userId: string): Promise<FlushResult | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, deleted: false },
      select: {
        id: true,
        memberId: true,
        rank: true,
        leftWaitingPV: true,
        rightWaitingPV: true,
        isAdmin: true,
      },
    });

    if (!user) {
      return null;
    }

    // Skip superadmins and users without eligible rank
    const { isSuperAdminSync } = await import('@/lib/superadmin-helper');
    if (isSuperAdminSync(user) || user.isAdmin) {
      return null;
    }

    const rule = BONUS_CONFIG[user.rank];
    if (!rule) {
      // User rank not eligible for Daily Match - no flush needed
      return null;
    }

    const leftWaitingPV = Number(user.leftWaitingPV) || 0;
    const rightWaitingPV = Number(user.rightWaitingPV) || 0;
    const maxMatchablePV = calculateMaxMatchablePV(rule.dailyCapAmount);

    // Calculate excess PV (points beyond what can be matched in one day)
    // Excess = max(0, waitingPV - maxMatchablePV)
    const leftExcess = Math.max(0, leftWaitingPV - maxMatchablePV);
    const rightExcess = Math.max(0, rightWaitingPV - maxMatchablePV);

    // If no excess, skip this user
    if (leftExcess === 0 && rightExcess === 0) {
      return null;
    }

    // Calculate new waiting PV (capped at maxMatchablePV)
    const leftAfterFlush = Math.min(leftWaitingPV, maxMatchablePV);
    const rightAfterFlush = Math.min(rightWaitingPV, maxMatchablePV);

    // Update waiting PV in database
    await PVMatchingService.updateWaitingPV(userId, leftAfterFlush, rightAfterFlush);

    const result: FlushResult = {
      userId: user.id,
      memberId: user.memberId,
      rank: user.rank,
      leftWaitingPVBefore: leftWaitingPV,
      rightWaitingPVBefore: rightWaitingPV,
      leftWaitingPVAfter: leftAfterFlush,
      rightWaitingPVAfter: rightAfterFlush,
      leftFlushed: leftExcess,
      rightFlushed: rightExcess,
      dailyCapAmount: rule.dailyCapAmount,
      maxMatchablePV,
    };

    logger.info('Excess PV flushed', {
      userId: user.id,
      memberId: user.memberId,
      rank: user.rank,
      leftFlushed: leftExcess,
      rightFlushed: rightExcess,
      maxMatchablePV,
      dailyCapAmount: rule.dailyCapAmount,
    });

    return result;
  } catch (error) {
    logger.error('Error flushing excess PV for user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
}

/**
 * Main flush function - processes all eligible users
 */
export async function flushExcessPoints(): Promise<{
  success: boolean;
  totalProcessed: number;
  totalFlushed: number;
  results: FlushResult[];
  errors: string[];
}> {
  const startTime = Date.now();
  const results: FlushResult[] = [];
  const errors: string[] = [];
  let totalProcessed = 0;
  let totalFlushed = 0;

  try {
    logger.info('Starting daily flush of excess points', {
      timestamp: new Date().toISOString(),
    });

    // Get all active users with eligible ranks
    const eligibleRanks = Object.keys(BONUS_CONFIG);
    const users = await prisma.user.findMany({
      where: {
        deleted: false,
        active: true,
        rank: { in: eligibleRanks },
      },
      select: {
        id: true,
      },
      // Process in batches to avoid memory issues
      take: 10000,
    });

    logger.info('Found eligible users for flush', {
      count: users.length,
    });

    // Process each user
    for (const user of users) {
      try {
        totalProcessed++;
        const result = await flushUserExcessPV(user.id);
        
        if (result) {
          results.push(result);
          totalFlushed++;
          if (result.leftFlushed > 0 || result.rightFlushed > 0) {
            totalFlushed += result.leftFlushed + result.rightFlushed;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${user.id}: ${errorMsg}`);
        logger.error('Error processing user in flush', {
          userId: user.id,
          error: errorMsg,
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Daily flush completed', {
      totalProcessed,
      totalFlushed,
      usersWithExcess: results.length,
      duration: `${duration}ms`,
      errors: errors.length,
    });

    return {
      success: true,
      totalProcessed,
      totalFlushed,
      results,
      errors,
    };
  } catch (error) {
    logger.error('Critical error in daily flush', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      totalProcessed,
      totalFlushed,
      results,
      errors: [...errors, `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Initialize scheduled flush job
 * Should be called during application startup
 */
export function initializeDailyFlushJob(): void {
  try {
    // Check if node-cron is available
    let cron: any;
    try {
      cron = require('node-cron');
    } catch (e) {
      logger.warn('node-cron not available, daily flush job will not be scheduled', {
        error: e instanceof Error ? e.message : 'Unknown error',
      });
      return;
    }

    // Schedule job to run at 1:00 AM every day
    // Cron format: '0 1 * * *' = minute 0, hour 1, every day
    const job = cron.schedule('0 1 * * *', async () => {
      logger.info('Scheduled daily flush job triggered', {
        timestamp: new Date().toISOString(),
      });

      try {
        const result = await flushExcessPoints();
        logger.info('Scheduled daily flush completed', {
          success: result.success,
          totalProcessed: result.totalProcessed,
          totalFlushed: result.totalFlushed,
          errors: result.errors.length,
        });
      } catch (error) {
        logger.error('Error in scheduled daily flush', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC', // Adjust timezone as needed
    });

    logger.info('Daily flush job scheduled', {
      schedule: '0 1 * * * (1:00 AM daily)',
      timezone: 'UTC',
    });

    return job;
  } catch (error) {
    logger.error('Failed to initialize daily flush job', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
