/**
 * COMMISSION QUEUE SERVICE
 * 
 * Prevents commission calculation spam by queuing and debouncing
 * 
 * Features:
 * - Debouncing (waits for quiet period)
 * - Single execution guarantee
 * - Prevents overlapping cycles
 * - Automatic cleanup
 * 
 * Created: 2025-10-19 (Deep Dive Audit Fix)
 */

import { logger } from '@/lib/logger';

class CommissionQueue {
  private debounceTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private pendingTriggers: Set<string> = new Set();
  private readonly DEBOUNCE_MS = 5000; // Wait 5 seconds after last trigger
  private readonly MAX_PENDING = 100; // Prevent memory issues

  /**
   * Schedule a commission calculation
   * Multiple calls within debounce window will result in single execution
   */
  async scheduleCalculation(triggeredBy: string, metadata?: Record<string, any>): Promise<void> {
    // Track trigger
    if (this.pendingTriggers.size < this.MAX_PENDING) {
      this.pendingTriggers.add(triggeredBy);
    }

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(async () => {
      await this.executeCommissionCycle();
    }, this.DEBOUNCE_MS);

    logger.debug('Commission calculation scheduled', {
      triggeredBy,
      pendingTriggers: this.pendingTriggers.size,
      debounceMs: this.DEBOUNCE_MS
    });
  }

  /**
   * Execute commission cycle (ensures single execution)
   */
  private async executeCommissionCycle(): Promise<void> {
    // Prevent overlapping executions
    if (this.isRunning) {
      logger.warn('Commission cycle already running, skipping duplicate execution');
      return;
    }

    this.isRunning = true;
    const triggerCount = this.pendingTriggers.size;
    const triggers = Array.from(this.pendingTriggers);
    this.pendingTriggers.clear();

    try {
      logger.info('Starting commission cycle', {
        triggerCount,
        triggers: triggers.slice(0, 5) // Log first 5
      });

      // Dynamic import to avoid circular dependencies
      const { runCommissionCycleServer } = await import('./commission-service');
      const result = await runCommissionCycleServer();

      logger.info('Commission cycle completed', {
        triggerCount,
        commissionsCreated: result.count,
        totalPayout: result.total
      });
    } catch (error) {
      logger.error('Commission cycle failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        triggerCount
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Force immediate execution (for admin-triggered cycles)
   */
  async forceExecution(): Promise<void> {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    await this.executeCommissionCycle();
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isRunning: boolean;
    pendingTriggers: number;
    hasScheduled: boolean;
  } {
    return {
      isRunning: this.isRunning,
      pendingTriggers: this.pendingTriggers.size,
      hasScheduled: this.debounceTimer !== null
    };
  }

  /**
   * Cancel pending execution
   */
  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingTriggers.clear();
    logger.info('Commission queue cancelled');
  }
}

// Export singleton instance
export const commissionQueue = new CommissionQueue();

/**
 * Convenience function to schedule commission calculation
 */
export async function scheduleCommissionCalculation(
  triggeredBy: string,
  metadata?: Record<string, any>
): Promise<void> {
  await commissionQueue.scheduleCalculation(triggeredBy, metadata);
}

/**
 * Force immediate commission calculation (admin use)
 */
export async function forceCommissionCalculation(): Promise<void> {
  await commissionQueue.forceExecution();
}

/**
 * Get commission queue status
 */
export function getCommissionQueueStatus() {
  return commissionQueue.getStatus();
}