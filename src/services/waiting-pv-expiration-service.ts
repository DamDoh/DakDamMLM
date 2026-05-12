/**
 * Waiting PV Expiration Service - Safety Rule #2: Carry Forward Policy
 * 
 * REQUIREMENT:
 * - Unmatched points on the Strong Leg should be allowed to roll over to the next day
 * - These carried-forward points must NOT be stored for more than 12 months (1 year)
 * 
 * IMPLEMENTATION:
 * - Tracks when waiting PV was created/updated
 * - Expires waiting PV older than 12 months
 * - Runs monthly cleanup job to reset expired waiting PV
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { PVMatchingService } from './pv-matching-service';

export interface ExpirationResult {
  userId: string;
  memberId: string | null;
  leftWaitingPVBefore: number;
  rightWaitingPVBefore: number;
  leftWaitingPVAfter: number;
  rightWaitingPVAfter: number;
  leftExpired: number;
  rightExpired: number;
  leftWaitingPVCreatedAt: Date | null;
  rightWaitingPVCreatedAt: Date | null;
}

const EXPIRATION_MONTHS = 12; // 12 months = 1 year

/**
 * Calculate expiration date (12 months ago)
 */
function getExpirationDate(): Date {
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() - EXPIRATION_MONTHS);
  return expirationDate;
}

/**
 * Expire old waiting PV for a single user
 * Resets waiting PV to 0 if it's older than 12 months
 */
async function expireUserWaitingPV(userId: string): Promise<ExpirationResult | null> {
  try {
    // Get user with waiting PV and timestamps
    // Note: Timestamp columns may not exist yet - use raw query for safety
    const user = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        "memberId",
        "leftWaitingPV",
        "rightWaitingPV",
        "leftWaitingPVCreatedAt",
        "rightWaitingPVCreatedAt"
      FROM "users"
      WHERE id = ${userId} AND deleted = false
      LIMIT 1
    `;
    
    const userData = user[0];
    if (!userData) {
      return null;
    }

    if (!user) {
      return null;
    }

    const leftWaitingPV = Number(userData.leftWaitingPV) || 0;
    const rightWaitingPV = Number(userData.rightWaitingPV) || 0;
    const expirationDate = getExpirationDate();

    // Check if left waiting PV has expired
    const leftExpired = 
      leftWaitingPV > 0 && 
      userData.leftWaitingPVCreatedAt && 
      new Date(userData.leftWaitingPVCreatedAt) < expirationDate;

    // Check if right waiting PV has expired
    const rightExpired = 
      rightWaitingPV > 0 && 
      userData.rightWaitingPVCreatedAt && 
      new Date(userData.rightWaitingPVCreatedAt) < expirationDate;

    // If nothing expired, skip this user
    if (!leftExpired && !rightExpired) {
      return null;
    }

    // Calculate new waiting PV (reset expired to 0)
    const leftAfterExpiration = leftExpired ? 0 : leftWaitingPV;
    const rightAfterExpiration = rightExpired ? 0 : rightWaitingPV;

    // Update waiting PV in database
    await PVMatchingService.updateWaitingPV(userId, leftAfterExpiration, rightAfterExpiration);

    // Reset timestamps if PV was expired
    if (leftExpired || rightExpired) {
      try {
        // Build dynamic SQL based on what needs to be reset
        if (leftExpired && rightExpired) {
          await prisma.$executeRaw`
            UPDATE "users"
            SET 
              "leftWaitingPVCreatedAt" = NULL,
              "rightWaitingPVCreatedAt" = NULL,
              "updatedAt" = NOW()
            WHERE "id" = ${userId}
          `;
        } else if (leftExpired) {
          await prisma.$executeRaw`
            UPDATE "users"
            SET 
              "leftWaitingPVCreatedAt" = NULL,
              "updatedAt" = NOW()
            WHERE "id" = ${userId}
          `;
        } else if (rightExpired) {
          await prisma.$executeRaw`
            UPDATE "users"
            SET 
              "rightWaitingPVCreatedAt" = NULL,
              "updatedAt" = NOW()
            WHERE "id" = ${userId}
          `;
        }
      } catch (error) {
        // If timestamp columns don't exist, that's okay - we still reset the PV
        logger.debug('Could not update waiting PV timestamps (columns may not exist)', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const result: ExpirationResult = {
      userId: userData.id,
      memberId: userData.memberId,
      leftWaitingPVBefore: leftWaitingPV,
      rightWaitingPVBefore: rightWaitingPV,
      leftWaitingPVAfter: leftAfterExpiration,
      rightWaitingPVAfter: rightAfterExpiration,
      leftExpired: leftExpired ? leftWaitingPV : 0,
      rightExpired: rightExpired ? rightWaitingPV : 0,
      leftWaitingPVCreatedAt: userData.leftWaitingPVCreatedAt ? new Date(userData.leftWaitingPVCreatedAt) : null,
      rightWaitingPVCreatedAt: userData.rightWaitingPVCreatedAt ? new Date(userData.rightWaitingPVCreatedAt) : null,
    };

    logger.info('Expired waiting PV', {
      userId: userData.id,
      memberId: userData.memberId,
      leftExpired: result.leftExpired,
      rightExpired: result.rightExpired,
      expirationDate: expirationDate.toISOString(),
    });

    return result;
  } catch (error) {
    logger.error('Error expiring waiting PV for user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
}

/**
 * Main expiration function - processes all users with waiting PV
 */
export async function expireOldWaitingPV(): Promise<{
  success: boolean;
  totalProcessed: number;
  totalExpired: number;
  results: ExpirationResult[];
  errors: string[];
}> {
  const startTime = Date.now();
  const results: ExpirationResult[] = [];
  const errors: string[] = [];
  let totalProcessed = 0;
  let totalExpired = 0;

  try {
    const expirationDate = getExpirationDate();
    logger.info('Starting waiting PV expiration check', {
      timestamp: new Date().toISOString(),
      expirationDate: expirationDate.toISOString(),
      expirationMonths: EXPIRATION_MONTHS,
    });

    // Get all active users with waiting PV
    // We'll check users who have either waiting PV > 0 or have timestamps
    const users = await prisma.user.findMany({
      where: {
        deleted: false,
        active: true,
        OR: [
          { leftWaitingPV: { gt: 0 } },
          { rightWaitingPV: { gt: 0 } },
        ],
      },
      select: {
        id: true,
      },
      // Process in batches to avoid memory issues
      take: 10000,
    });

    logger.info('Found users with waiting PV for expiration check', {
      count: users.length,
    });

    // Process each user
    for (const user of users) {
      try {
        totalProcessed++;
        const result = await expireUserWaitingPV(user.id);
        
        if (result) {
          results.push(result);
          if (result.leftExpired > 0 || result.rightExpired > 0) {
            totalExpired += result.leftExpired + result.rightExpired;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${user.id}: ${errorMsg}`);
        logger.error('Error processing user in expiration', {
          userId: user.id,
          error: errorMsg,
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Waiting PV expiration check completed', {
      totalProcessed,
      totalExpired,
      usersWithExpiredPV: results.length,
      duration: `${duration}ms`,
      errors: errors.length,
    });

    return {
      success: true,
      totalProcessed,
      totalExpired,
      results,
      errors,
    };
  } catch (error) {
    logger.error('Critical error in waiting PV expiration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      totalProcessed,
      totalExpired,
      results,
      errors: [...errors, `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Initialize scheduled expiration job
 * Should be called during application startup
 * Runs monthly on the 1st at 2:00 AM
 */
export function initializeWaitingPVExpirationJob(): void {
  try {
    // Check if node-cron is available
    let cron: any;
    try {
      cron = require('node-cron');
    } catch (e) {
      logger.warn('node-cron not available, waiting PV expiration job will not be scheduled', {
        error: e instanceof Error ? e.message : 'Unknown error',
      });
      return;
    }

    // Schedule job to run monthly on the 1st at 2:00 AM
    // Cron format: '0 2 1 * *' = minute 0, hour 2, day 1, every month
    const job = cron.schedule('0 2 1 * *', async () => {
      logger.info('Scheduled waiting PV expiration job triggered', {
        timestamp: new Date().toISOString(),
      });

      try {
        const result = await expireOldWaitingPV();
        logger.info('Scheduled waiting PV expiration completed', {
          success: result.success,
          totalProcessed: result.totalProcessed,
          totalExpired: result.totalExpired,
          errors: result.errors.length,
        });
      } catch (error) {
        logger.error('Error in scheduled waiting PV expiration', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC', // Adjust timezone as needed
    });

    logger.info('Waiting PV expiration job scheduled', {
      schedule: '0 2 1 * * (2:00 AM on 1st of each month)',
      timezone: 'UTC',
      expirationMonths: EXPIRATION_MONTHS,
    });

    return job;
  } catch (error) {
    logger.error('Failed to initialize waiting PV expiration job', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
