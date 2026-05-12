import { prisma } from '@/lib/database';

export class OrderMetrics {
  async getAverageOrderValue(): Promise<number> {
    try {
      // First, get all non-admin, non-deleted user IDs
      const eligibleUsers = await prisma.user.findMany({
        where: {
          isAdmin: false,
          deleted: false
        },
        select: {
          id: true
        }
      });

      const userIds = eligibleUsers.map(u => u.id);

      // Then aggregate orders for those users
      const result = await prisma.order.aggregate({
        _avg: {
          totalAmount: true
        },
        _count: {
          _all: true
        },
        where: {
          userId: {
            in: userIds
          }
        }
      });

      return (result._count._all > 0 && result._avg.totalAmount) ? result._avg.totalAmount : 0;
    } catch (error) {
      console.error('Failed to get average order value:', error);
      return 0;
    }
  }

  async getTotalVolume(): Promise<number> {
    try {
      // First, get all non-admin, non-deleted user IDs
      const eligibleUsers = await prisma.user.findMany({
        where: {
          isAdmin: false,
          deleted: false
        },
        select: {
          id: true
        }
      });

      const userIds = eligibleUsers.map(u => u.id);

      // Then aggregate orders for those users
      const result = await prisma.order.aggregate({
        _sum: {
          totalAmount: true
        },
        where: {
          userId: {
            in: userIds
          }
        }
      });

      return result._sum?.totalAmount || 0;
    } catch (error) {
      console.error('Failed to get total volume:', error);
      return 0;
    }
  }
}