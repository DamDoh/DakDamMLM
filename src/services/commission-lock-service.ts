/**
 * CRITICAL FIX #3: Commission Calculation Lock Service
 * 
 * Prevents duplicate commission calculations from:
 * - Multiple admin users triggering at same time
 * - Cron job + manual trigger overlap
 * - System restarts during calculation
 * 
 * Uses database-backed locking for distributed environment
 */

import { prisma } from '@/lib/prisma';

export interface CommissionLock {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'locked' | 'completed' | 'failed';
  lockedBy: string;
  lockedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class CommissionLockService {
  private static readonly LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Acquire lock for commission calculation period
   * Returns lock if acquired, null if already locked
   */
  static async acquireLock(
    periodStart: Date,
    periodEnd: Date,
    lockedBy: string
  ): Promise<CommissionLock | null> {
    try {
      // Check if there's an active lock for this period
      const existingLock = await prisma.$queryRaw<CommissionLock[]>`
        SELECT * FROM commission_locks
        WHERE period_start = ${periodStart}
          AND period_end = ${periodEnd}
          AND status = 'locked'
          AND locked_at > NOW() - INTERVAL '30 minutes'
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

      if (existingLock.length > 0) {
        console.log(`Commission calculation already locked for period ${periodStart} - ${periodEnd}`);
        return null; // Already locked
      }

      // Check if already completed
      const completedLock = await prisma.$queryRaw<CommissionLock[]>`
        SELECT * FROM commission_locks
        WHERE period_start = ${periodStart}
          AND period_end = ${periodEnd}
          AND status = 'completed'
        LIMIT 1
      `;

      if (completedLock.length > 0) {
        console.log(`Commission already calculated for period ${periodStart} - ${periodEnd}`);
        return null; // Already completed
      }

      // Create new lock
      const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const [lock] = await prisma.$queryRaw<CommissionLock[]>`
        INSERT INTO commission_locks (id, period_start, period_end, status, locked_by, locked_at)
        VALUES (${lockId}, ${periodStart}, ${periodEnd}, 'locked', ${lockedBy}, NOW())
        RETURNING *
      `;

      console.log(`Commission lock acquired: ${lockId} by ${lockedBy}`);
      return lock;
    } catch (error) {
      console.error('Failed to acquire commission lock:', error);
      return null;
    }
  }

  /**
   * Release lock after completion
   */
  static async releaseLock(
    lockId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.$queryRaw`
        UPDATE commission_locks
        SET status = ${success ? 'completed' : 'failed'},
            completed_at = NOW(),
            error_message = ${errorMessage || null}
        WHERE id = ${lockId}
      `;

      console.log(`Commission lock released: ${lockId} - ${success ? 'success' : 'failed'}`);
    } catch (error) {
      console.error('Failed to release commission lock:', error);
    }
  }

  /**
   * Check if calculation is locked for period
   */
  static async isLocked(periodStart: Date, periodEnd: Date): Promise<boolean> {
    try {
      const locks = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count
        FROM commission_locks
        WHERE period_start = ${periodStart}
          AND period_end = ${periodEnd}
          AND status = 'locked'
          AND locked_at > NOW() - INTERVAL '30 minutes'
      `;

      return locks[0].count > 0;
    } catch (error) {
      console.error('Failed to check commission lock:', error);
      return false;
    }
  }

  /**
   * Clean up old/stale locks
   * Run periodically to remove locks from crashed processes
   */
  static async cleanupStaleLocks(): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        UPDATE commission_locks
        SET status = 'failed',
            error_message = 'Lock expired (timeout)',
            completed_at = NOW()
        WHERE status = 'locked'
          AND locked_at < NOW() - INTERVAL '30 minutes'
      `;

      if (result > 0) {
        console.log(`Cleaned up ${result} stale commission locks`);
      }

      return result;
    } catch (error) {
      console.error('Failed to cleanup stale locks:', error);
      return 0;
    }
  }

  /**
   * Get lock history for period
   */
  static async getLockHistory(
    periodStart?: Date,
    periodEnd?: Date,
    limit: number = 20
  ): Promise<CommissionLock[]> {
    try {
      const locks = await prisma.$queryRaw<CommissionLock[]>`
        SELECT *
        FROM commission_locks
        WHERE 1=1
          ${periodStart ? prisma.$queryRawUnsafe(`AND period_start >= '${periodStart.toISOString()}'`) : prisma.$queryRawUnsafe('')}
          ${periodEnd ? prisma.$queryRawUnsafe(`AND period_end <= '${periodEnd.toISOString()}'`) : prisma.$queryRawUnsafe('')}
        ORDER BY locked_at DESC
        LIMIT ${limit}
      `;

      return locks;
    } catch (error) {
      console.error('Failed to get lock history:', error);
      return [];
    }
  }
}

/**
 * Create commission_locks table migration
 * Run this SQL manually or add to migrations:
 */
export const COMMISSION_LOCKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS commission_locks (
  id VARCHAR(255) PRIMARY KEY,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  locked_by VARCHAR(255) NOT NULL,
  locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_period (period_start, period_end),
  INDEX idx_status (status),
  INDEX idx_locked_at (locked_at),
  
  -- Unique constraint: one active lock per period
  UNIQUE (period_start, period_end, status)
);
`;
