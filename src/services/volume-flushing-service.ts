/**
 * HIGH PRIORITY FIX #7: Volume Flushing Service
 * 
 * In binary MLM, after commission is calculated:
 * 1. Matched volume is "flushed" from both legs
 * 2. Remaining volume carries forward to next period
 * 
 * Example:
 * Left Leg: 1000 PV
 * Right Leg: 600 PV
 * Weaker Leg: 600 PV (commission paid on this)
 * After Flush:
 *   Left: 1000 - 600 = 400 PV (carried forward)
 *   Right: 600 - 600 = 0 PV (flushed)
 */

import { prisma } from '@/lib/prisma';

export interface VolumeCarryover {
  userId: string;
  periodEnd: Date;
  leftCarryover: number;
  rightCarryover: number;
  matchedVolume: number;
  createdAt: Date;
}

export class VolumeFlushingService {
  /**
   * Flush matched volume after commission calculation
   * CRITICAL for accurate next-period calculations
   */
  static async flushMatchedVolume(
    userId: string,
    leftVolume: number,
    rightVolume: number,
    periodEnd: Date
  ): Promise<VolumeCarryover> {
    // Calculate matched volume (weaker leg)
    const matchedVolume = Math.min(leftVolume, rightVolume);

    // Calculate carryover (remaining after flush)
    const leftCarryover = Math.max(0, leftVolume - matchedVolume);
    const rightCarryover = Math.max(0, rightVolume - matchedVolume);

    // Store carryover for next period
    const carryover = await prisma.$queryRaw<VolumeCarryover[]>`
      INSERT INTO volume_carryovers (
        user_id, 
        period_end, 
        left_carryover, 
        right_carryover, 
        matched_volume,
        created_at
      )
      VALUES (
        ${userId},
        ${periodEnd},
        ${leftCarryover},
        ${rightCarryover},
        ${matchedVolume},
        NOW()
      )
      ON CONFLICT (user_id, period_end) 
      DO UPDATE SET
        left_carryover = ${leftCarryover},
        right_carryover = ${rightCarryover},
        matched_volume = ${matchedVolume}
      RETURNING *
    `;

    console.log(`Volume flushed for user ${userId}: Matched=${matchedVolume}, Left Carryover=${leftCarryover}, Right Carryover=${rightCarryover}`);

    return carryover[0];
  }

  /**
   * Get carryover volume from previous period
   * Use this when calculating current period volume
   */
  static async getCarryoverVolume(
    userId: string,
    periodStart: Date
  ): Promise<{ leftCarryover: number; rightCarryover: number }> {
    // Get the most recent carryover before this period
    const carryover = await prisma.$queryRaw<VolumeCarryover[]>`
      SELECT * FROM volume_carryovers
      WHERE user_id = ${userId}
        AND period_end < ${periodStart}
      ORDER BY period_end DESC
      LIMIT 1
    `;

    if (carryover.length === 0) {
      return { leftCarryover: 0, rightCarryover: 0 };
    }

    return {
      leftCarryover: carryover[0].leftCarryover,
      rightCarryover: carryover[0].rightCarryover
    };
  }

  /**
   * Calculate total volume including carryover
   * Use this in commission calculation
   */
  static async calculateTotalVolume(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    currentLeftVolume: number,
    currentRightVolume: number
  ): Promise<{
    totalLeftVolume: number;
    totalRightVolume: number;
    carryoverLeft: number;
    carryoverRight: number;
  }> {
    const carryover = await this.getCarryoverVolume(userId, periodStart);

    return {
      totalLeftVolume: currentLeftVolume + carryover.leftCarryover,
      totalRightVolume: currentRightVolume + carryover.rightCarryover,
      carryoverLeft: carryover.leftCarryover,
      carryoverRight: carryover.rightCarryover
    };
  }

  /**
   * Get volume carryover history for user
   */
  static async getCarryoverHistory(
    userId: string,
    limit: number = 12
  ): Promise<VolumeCarryover[]> {
    const history = await prisma.$queryRaw<VolumeCarryover[]>`
      SELECT * FROM volume_carryovers
      WHERE user_id = ${userId}
      ORDER BY period_end DESC
      LIMIT ${limit}
    `;

    return history;
  }

  /**
   * Clean up old carryover records (older than 2 years)
   * Run periodically to prevent table bloat
   */
  static async cleanupOldCarryovers(): Promise<number> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const result = await prisma.$executeRaw`
      DELETE FROM volume_carryovers
      WHERE period_end < ${twoYearsAgo}
    `;

    if (result > 0) {
      console.log(`Cleaned up ${result} old volume carryover records`);
    }

    return result;
  }

  /**
   * Get users with significant carryover (for analysis)
   */
  static async getUsersWithHighCarryover(
    threshold: number = 1000,
    companyId?: string
  ): Promise<Array<{ userId: string; totalCarryover: number }>> {
    const companyFilter = companyId 
      ? `AND u.company_id = '${companyId}'`
      : '';

    const users = await prisma.$queryRawUnsafe<Array<{
      userId: string;
      totalCarryover: number;
    }>>(`
      SELECT 
        vc.user_id as "userId",
        (vc.left_carryover + vc.right_carryover) as "totalCarryover"
      FROM volume_carryovers vc
      JOIN users u ON u.id = vc.user_id
      WHERE (vc.left_carryover + vc.right_carryover) > ${threshold}
        ${companyFilter}
      ORDER BY "totalCarryover" DESC
      LIMIT 100
    `);

    return users;
  }

  /**
   * Reset all carryovers for a user (admin function)
   * Use with caution - only for corrections
   */
  static async resetUserCarryover(
    userId: string,
    periodEnd: Date,
    reason: string
  ): Promise<void> {
    await prisma.$queryRaw`
      INSERT INTO volume_carryovers (
        user_id, 
        period_end, 
        left_carryover, 
        right_carryover, 
        matched_volume,
        created_at
      )
      VALUES (
        ${userId},
        ${periodEnd},
        0,
        0,
        0,
        NOW()
      )
      ON CONFLICT (user_id, period_end) 
      DO UPDATE SET
        left_carryover = 0,
        right_carryover = 0,
        matched_volume = 0
    `;

    // Log the reset
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'volume_carryover_reset',
        entity: 'volume_carryover',
        changes: { reason, periodEnd },
        ipAddress: 'system',
        userAgent: 'admin'
      }
    });

    console.log(`Volume carryover reset for user ${userId}. Reason: ${reason}`);
  }
}

/**
 * Create volume_carryovers table migration
 * Run this SQL manually:
 */
export const VOLUME_CARRYOVERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS volume_carryovers (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  period_end TIMESTAMP NOT NULL,
  left_carryover NUMERIC(10, 2) NOT NULL DEFAULT 0,
  right_carryover NUMERIC(10, 2) NOT NULL DEFAULT 0,
  matched_volume NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one carryover per user per period
  UNIQUE (user_id, period_end),
  
  -- Foreign key
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_volume_carryovers_user (user_id),
  INDEX idx_volume_carryovers_period (period_end),
  INDEX idx_volume_carryovers_user_period (user_id, period_end)
);
`;
