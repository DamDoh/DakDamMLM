/**
 * COMMISSION QUEUE SERVICE
 *
 * Queues commission calculations to prevent database overload
 * from concurrent order processing.
 */

import { logger } from '@/lib/logger';

// Simple in-memory queue for now
// In production, this should use Redis, Bull, or similar
const commissionQueue: Array<{
  id: string;
  data: any;
  timestamp: number;
}> = [];

// Process queue every 5 seconds
setInterval(async () => {
  if (commissionQueue.length > 0) {
    const item = commissionQueue.shift();
    if (item) {
      try {
        // Import commission service dynamically to avoid circular imports
        const { CommissionService } = await import('./commission-service');

        await CommissionService.calculateCommissionsForOrder(
          item.data.orderId,
          item.data.userId,
          item.data.totalPV
        );

        logger.info('Commission calculation completed', {
          orderId: item.data.orderId,
          queueSize: commissionQueue.length
        });
      } catch (error) {
        logger.error('Commission calculation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          orderId: item.data.orderId
        });
      }
    }
  }
}, 5000);

/**
 * Schedule commission calculation for later processing
 */
export async function scheduleCommissionCalculation(
  id: string,
  data: {
    orderId: string;
    userId: string;
    totalPV: number;
  }
): Promise<void> {
  commissionQueue.push({
    id,
    data,
    timestamp: Date.now()
  });

  logger.info('Commission calculation scheduled', {
    id,
    orderId: data.orderId,
    queueSize: commissionQueue.length
  });
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return {
    queueSize: commissionQueue.length,
    oldestItem: commissionQueue[0]?.timestamp || null
  };
}