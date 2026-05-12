import { genealogyDb as db } from '../config/database';
import { Member } from '../../../../shared/types';

export class GenealogyRepository {
  async findUserById(id: string) {
    return await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        pv: true,
        createdAt: true,
        sponsorId: true,
        placementParentId: true,
        position: true,
        children: true,
        active: true,
      }
    });
  }

  async findUserWithChildren(id: string) {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        pv: true,
        createdAt: true,
        children: true,
      }
    });

    if (!user) return null;

    // Fetch children separately since children is a Json field, not a relation
    const children = user.children as { left?: string | null; right?: string | null } | null;
    const leftChildId = children?.left;
    const rightChildId = children?.right;

    const [leftChild, rightChild] = await Promise.all([
      leftChildId ? db.user.findUnique({
        where: { id: leftChildId },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          rank: true,
          pv: true,
          createdAt: true,
          active: true,
        }
      }) : null,
      rightChildId ? db.user.findUnique({
        where: { id: rightChildId },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          rank: true,
          pv: true,
          createdAt: true,
          active: true,
        }
      }) : null,
    ]);

    return {
      ...user,
      children: {
        left: leftChild,
        right: rightChild,
      }
    };
  }

  async findDownlineBySponsor(sponsorId: string) {
    return await db.user.findMany({
      where: { sponsorId },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        pv: true,
        createdAt: true,
        active: true,
        sponsorId: true,
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findUplineById(id: string): Promise<any[]> {
    const upline: any[] = [];
    let currentId = id;

    while (currentId) {
      const user = await this.findUserById(currentId);
      if (!user) break;

      upline.unshift(user);
      currentId = user.sponsorId || '';
    }

    return upline;
  }

  async updateUserChildren(userId: string, children: { left?: string | null; right?: string | null }) {
    return await db.user.update({
      where: { id: userId },
      data: { children }
    });
  }

  async updateUserSponsor(userId: string, sponsorId: string) {
    return await db.user.update({
      where: { id: userId },
      data: { sponsorId }
    });
  }

  async getUserCountBySponsor(sponsorId: string): Promise<number> {
    return await db.user.count({
      where: { sponsorId }
    });
  }

  async getActiveUserCountBySponsor(sponsorId: string): Promise<number> {
    return await db.user.count({
      where: {
        sponsorId,
        active: true
      }
    });
  }

  async getTotalPVBySponsor(sponsorId: string): Promise<number> {
    const result = await db.user.aggregate({
      where: { sponsorId },
      _sum: { pv: true }
    });

    return result._sum.pv || 0;
  }

  async getActivePVBySponsor(sponsorId: string): Promise<number> {
    const result = await db.user.aggregate({
      where: {
        sponsorId,
        active: true
      },
      _sum: { pv: true }
    });

    return result._sum.pv || 0;
  }

  async getMaxLevelBySponsor(sponsorId: string): Promise<number> {
    // This is a simplified implementation
    // In a real scenario, you might need a more complex query or stored procedure
    const downline = await this.getAllDownlineLevels(sponsorId);
    return downline.length > 0 ? Math.max(...downline.map(d => d.level)) : 0;
  }

  private async getAllDownlineLevels(sponsorId: string): Promise<Array<{ level: number }>> {
    const downline: Array<{ level: number }> = [];
    const queue: Array<{ id: string; level: number }> = [{ id: sponsorId, level: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = await this.findDownlineBySponsor(current.id);

      for (const child of children) {
        downline.push({ level: current.level + 1 });
        queue.push({ id: child.id, level: current.level + 1 });
      }
    }

    return downline;
  }

  async getUserWithSponsor(id: string) {
    return await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        pv: true,
        createdAt: true,
        sponsorId: true,
        placementParentId: true,
        position: true,
        active: true,
        sponsor: {
          select: {
            id: true,
            fullName: true,
            memberId: true,
            rank: true,
          }
        }
      }
    });
  }

  async getUserPlacementInfo(id: string) {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        sponsorId: true,
        placementParentId: true,
        position: true,
        children: true,
        sponsor: {
          select: {
            id: true,
            fullName: true,
            memberId: true,
          }
        },
      }
    });

    if (!user) return null;

    // Fetch placement parent manually since there's no relation
    const placementParent = user.placementParentId
      ? await db.user.findUnique({
          where: { id: user.placementParentId },
          select: {
            id: true,
            fullName: true,
            memberId: true,
          }
        })
      : null;

    return {
      ...user,
      placementParent,
    };
  }

  async validatePlacementMove(userId: string, newParentId: string): Promise<boolean> {
    // Check if new parent has available position
    const newParent = await this.findUserById(newParentId);
    if (!newParent) return false;

    // Check if user is not trying to move to their own descendant
    return !(await this.isDescendant(userId, newParentId));
  }

  private async isDescendant(userId: string, potentialAncestorId: string): Promise<boolean> {
    const upline = await this.findUplineById(userId);
    return upline.some(user => user.id === potentialAncestorId);
  }

  async getDownlineCount(sponsorId: string, includeInactive: boolean = false): Promise<number> {
    if (includeInactive) {
      return await this.getUserCountBySponsor(sponsorId);
    } else {
      return await this.getActiveUserCountBySponsor(sponsorId);
    }
  }

  async getDownlinePV(sponsorId: string, includeInactive: boolean = false): Promise<number> {
    if (includeInactive) {
      return await this.getTotalPVBySponsor(sponsorId);
    } else {
      return await this.getActivePVBySponsor(sponsorId);
    }
  }

  async getRecentJoins(sponsorId: string, days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const count = await db.user.count({
      where: {
        sponsorId,
        createdAt: {
          gte: cutoffDate,
        },
      },
    });

    return count;
  }

  async getTopPerformers(sponsorId: string, limit: number = 5): Promise<any[]> {
    const downline = await db.user.findMany({
      where: { sponsorId },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        pv: true,
        rank: true,
        createdAt: true,
      },
      orderBy: { pv: 'desc' },
      take: limit,
    });

    return downline;
  }

  async getGenealogyDepth(sponsorId: string): Promise<number> {
    // This is a simplified implementation
    // In production, you might want a more efficient query or stored procedure
    const maxLevel = await this.getMaxLevelBySponsor(sponsorId);
    return maxLevel;
  }

  async updateUserStatus(userId: string, active: boolean): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { active, updatedAt: new Date() },
    });
  }

  async bulkUpdateUsers(updates: Array<{ id: string; data: any }>): Promise<void> {
    const updatePromises = updates.map(({ id, data }) =>
      db.user.update({
        where: { id },
        data: { ...data, updatedAt: new Date() },
      })
    );

    await Promise.all(updatePromises);
  }

  async getUserActivityStats(userId: string): Promise<any> {
    // Get user's downline activity statistics
    const downline = await this.findDownlineBySponsor(userId);

    const totalMembers = downline.length;
    const activeMembers = downline.filter((d: any) => d.active).length;
    const inactiveMembers = totalMembers - activeMembers;

    const totalPV = downline.reduce((sum: number, d: any) => sum + (d.pv || 0), 0);
    const activePV = downline.filter((d: any) => d.active).reduce((sum: number, d: any) => sum + (d.pv || 0), 0);

    // Calculate activity rate
    const activityRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;

    return {
      totalMembers,
      activeMembers,
      inactiveMembers,
      totalPV,
      activePV,
      activityRate: Math.round(activityRate * 100) / 100,
    };
  }

  async validateBulkOperation(operations: Array<{
    type: string;
    userId: string;
    data?: any;
  }>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const operation of operations) {
      try {
        const user = await this.findUserById(operation.userId);
        if (!user) {
          errors.push(`User ${operation.userId} not found`);
          continue;
        }

        switch (operation.type) {
          case 'move':
            if (!operation.data?.newParentId || !operation.data?.position) {
              errors.push(`Invalid move data for user ${operation.userId}`);
            } else {
              const isValid = await this.validatePlacementMove(operation.userId, operation.data.newParentId);
              if (!isValid) {
                errors.push(`Invalid move for user ${operation.userId}`);
              }
            }
            break;
          case 'activate':
          case 'deactivate':
            // These operations are generally safe
            break;
          default:
            errors.push(`Unknown operation type: ${operation.type} for user ${operation.userId}`);
        }
      } catch (error: any) {
        errors.push(`Validation error for user ${operation.userId}: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}