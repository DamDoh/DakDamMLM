import { prisma } from '@/lib/database';

export class MemberMetrics {
  async getTotalMembers(): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: {
          isAdmin: false,
          deleted: false
        }
      });
      return count;
    } catch (error) {
      console.error('Failed to get total members:', error);
      return 0;
    }
  }

  async getActiveMembers(): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: {
          active: true,
          isAdmin: false,
          deleted: false
        }
      });
      return count;
    } catch (error) {
      console.error('Failed to get active members:', error);
      return 0;
    }
  }

  async getNewMembersSince(date: Date): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: {
          createdAt: {
            gte: date
          },
          isAdmin: false,
          deleted: false
        }
      });
      return count;
    } catch (error) {
      console.error('Failed to get new members since date:', error);
      return 0;
    }
  }

  async getTopPerformers(count: number): Promise<{ memberId: string; name: string; volume: number; growth: number }[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          active: true,
          isAdmin: false,
          deleted: false
        },
        orderBy: {
          pv: 'desc'
        },
        take: count,
        select: {
          memberId: true,
          fullName: true,
          pv: true
        }
      });

      return users.map(user => ({
        memberId: user.memberId,
        name: user.fullName,
        volume: user.pv,
        growth: 0, // Growth calculation is complex and out of scope for this refactor
      }));
    } catch (error) {
      console.error('Failed to get top performers:', error);
      return [];
    }
  }
}