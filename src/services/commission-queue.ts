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

        await CommissionService.calculateCommissionsForOrder(item.data.orderId, item.data.userId, item.data.totalPV);

        // AUTO-CALCULATE G2 Binary Bonus: If order owner is a G2 downline, trigger G2 bonus for grandparent
        try {
          const { prisma } = await import('@/lib/prisma');
          const orderOwner = await prisma.user.findUnique({
            where: { id: item.data.userId },
            select: {
              id: true,
              placementParentId: true,
              memberId: true
            }
          });

          if (orderOwner?.placementParentId) {
            // Check if order owner is a G2 (has a G1 parent who has a grandparent)
            const g1Parent = await prisma.user.findUnique({
              where: { id: orderOwner.placementParentId },
              select: {
                id: true,
                placementParentId: true,
                memberId: true
              }
            });

            // If G1 has a parent (grandparent), trigger G2 Binary Bonus auto-calculation
            if (g1Parent?.placementParentId) {
              console.log(`🔄 Commission queue - Auto-calculating G2 Binary Bonus for grandparent:`, {
                orderId: item.data.orderId,
                orderOwnerId: orderOwner.memberId,
                g1Id: g1Parent.memberId,
                grandparentId: g1Parent.placementParentId
              });

              const { autoCalculateG2BinaryBonus } = await import('./g2-binary-bonus-auto-calc');
              await autoCalculateG2BinaryBonus(g1Parent.id, orderOwner.id);
            }
          }
        } catch (g2Error) {
          // Log but don't fail commission calculation if G2 calculation fails
          logger.warn('Failed to auto-calculate G2 Binary Bonus in commission queue', {
            orderId: item.data.orderId,
            userId: item.data.userId,
            error: g2Error instanceof Error ? g2Error.message : 'Unknown error'
          });
        }

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