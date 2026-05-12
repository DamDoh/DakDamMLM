import { prisma } from '@/lib/database';

export class CommissionMetrics {
  async getTotalCommissions(): Promise<number> {
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

      // Then aggregate commissions for those users
      const result = await prisma.commission.aggregate({
        _sum: {
          amount: true
        },
        where: {
          userId: {
            in: userIds
          }
        }
      });

      return result._sum.amount || 0;
    } catch (error) {
      console.error('Failed to get total commissions:', error);
      return 0;
    }
  }
}