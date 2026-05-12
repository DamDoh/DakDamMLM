import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface GenealogyNode {
  id: string;
  userId: string;
  sponsorId?: string;
  placementId?: string;
  position?: string;
  depth: number;
  leftCount: number;
  rightCount: number;
  totalDownline: number;
  leftVolume: number;
  rightVolume: number;
  totalVolume: number;
  children: GenealogyNode[];
}

export interface NetworkStats {
  totalMembers: number;
  activeMembers: number;
  totalVolume: number;
  averageVolume: number;
  depth: number;
  balanceRatio: number; // left/right balance
  growthRate: number; // monthly growth %
}

export class GenealogyService {
  /**
   * Build complete genealogy tree for a user
   */
  static async buildGenealogyTree(rootUserId: string, maxDepth: number = 10): Promise<GenealogyNode | null> {
    try {
      const root = await prisma.genealogyTree.findUnique({
        where: { userId: rootUserId }
      });

      if (!root) return null;

      const tree = await this.buildTreeRecursive(root, 0, maxDepth);
      return tree;
    } catch (error) {
      logger.error('Error building genealogy tree:', error);
      throw error;
    }
  }

  /**
   * Recursively build tree structure
   */
  private static async buildTreeRecursive(
    node: any,
    currentDepth: number,
    maxDepth: number
  ): Promise<GenealogyNode> {
    const children: GenealogyNode[] = [];

    if (currentDepth < maxDepth) {
      // Get direct children
      const directChildren = await prisma.genealogyTree.findMany({
        where: { sponsorId: node.userId }
      });

      for (const child of directChildren) {
        const childNode = await this.buildTreeRecursive(child, currentDepth + 1, maxDepth);
        children.push(childNode);
      }
    }

    return {
      id: node.id,
      userId: node.userId,
      sponsorId: node.sponsorId,
      placementId: node.placementId,
      position: node.position,
      depth: node.depth,
      leftCount: node.leftCount,
      rightCount: node.rightCount,
      totalDownline: node.totalDownline,
      leftVolume: node.leftVolume,
      rightVolume: node.rightVolume,
      totalVolume: node.totalVolume,
      children
    };
  }

  /**
   * Add new member to genealogy tree
   */
  static async addToGenealogy(
    userId: string,
    sponsorId: string,
    placementId?: string,
    position?: 'left' | 'right'
  ): Promise<void> {
    try {
      // Create genealogy entry
      const genealogyEntry = await prisma.genealogyTree.create({
        data: {
          userId,
          sponsorId,
          placementId,
          position,
          depth: 0 // Will be calculated
        }
      });

      // Update sponsor's downline counts
      await this.updateDownlineCounts(sponsorId);

      // Update depth
      await this.updateNodeDepth(userId);

      logger.info('Added member to genealogy', { userId, sponsorId });
    } catch (error) {
      logger.error('Error adding to genealogy:', error);
      throw error;
    }
  }

  /**
   * Update downline counts for a node and all ancestors
   */
  private static async updateDownlineCounts(userId: string): Promise<void> {
    const node = await prisma.genealogyTree.findUnique({
      where: { userId }
    });

    if (!node) return;

    // Count direct children
    const children = await prisma.genealogyTree.findMany({
      where: { sponsorId: userId },
      select: { position: true, userId: true }
    });

    let leftCount = 0;
    let rightCount = 0;

    for (const child of children) {
      if (child.position === 'left') leftCount++;
      else if (child.position === 'right') rightCount++;

      // Recursively update child's downline
      await this.updateDownlineCounts(child.userId);
    }

    // Update this node's counts
    await prisma.genealogyTree.update({
      where: { userId },
      data: {
        leftCount,
        rightCount,
        totalDownline: leftCount + rightCount
      }
    });

    // Update parent if exists
    if (node.sponsorId) {
      await this.updateDownlineCounts(node.sponsorId);
    }
  }

  /**
   * Update node depth in tree
   */
  private static async updateNodeDepth(userId: string): Promise<void> {
    const node = await prisma.genealogyTree.findUnique({
      where: { userId },
      select: { sponsorId: true }
    });

    if (!node) return;

    let depth = 0;
    let currentId = node.sponsorId;

    // Traverse up to root to calculate depth
    while (currentId) {
      depth++;
      const parent = await prisma.genealogyTree.findUnique({
        where: { userId: currentId },
        select: { sponsorId: true }
      });
      currentId = parent?.sponsorId;
    }

    await prisma.genealogyTree.update({
      where: { userId },
      data: { depth }
    });
  }

  /**
   * Calculate network statistics
   */
  static async calculateNetworkStats(rootUserId: string): Promise<NetworkStats> {
    try {
      const tree = await this.buildGenealogyTree(rootUserId);
      if (!tree) {
        return {
          totalMembers: 0,
          activeMembers: 0,
          totalVolume: 0,
          averageVolume: 0,
          depth: 0,
          balanceRatio: 0,
          growthRate: 0
        };
      }

      const stats = await this.analyzeTree(tree);

      return {
        totalMembers: stats.totalMembers,
        activeMembers: stats.activeMembers,
        totalVolume: tree.totalVolume,
        averageVolume: tree.totalVolume / Math.max(stats.totalMembers, 1),
        depth: stats.maxDepth,
        balanceRatio: tree.leftCount > 0 && tree.rightCount > 0 ?
          Math.min(tree.leftCount, tree.rightCount) / Math.max(tree.leftCount, tree.rightCount) : 0,
        growthRate: await this.calculateGrowthRate(rootUserId)
      };
    } catch (error) {
      logger.error('Error calculating network stats:', error);
      throw error;
    }
  }

  /**
   * Analyze tree structure
   */
  private static async analyzeTree(node: GenealogyNode): Promise<{
    totalMembers: number;
    activeMembers: number;
    maxDepth: number;
  }> {
    let totalMembers = 1; // Count current node
    let activeMembers = 0;
    let maxDepth = node.depth;

    // Check if current user is active
    const user = await prisma.user.findUnique({
      where: { id: node.userId },
      select: { active: true }
    });
    if (user?.active) activeMembers++;

    // Analyze children
    for (const child of node.children) {
      const childStats = await this.analyzeTree(child);
      totalMembers += childStats.totalMembers;
      activeMembers += childStats.activeMembers;
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
    }

    return { totalMembers, activeMembers, maxDepth };
  }

  /**
   * Calculate network growth rate (simplified)
   */
  private static async calculateGrowthRate(userId: string): Promise<number> {
    // Get member count for last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentMembers = await prisma.genealogyTree.count({
      where: {
        sponsorId: userId,
        createdAt: { gte: threeMonthsAgo }
      }
    });

    // Simple growth calculation - in reality would compare with previous periods
    return recentMembers * 4; // Monthly growth rate
  }

  /**
   * Find spillover placement for matrix systems
   */
  static async findSpilloverPlacement(sponsorId: string): Promise<{
    placementId: string;
    position: string;
  } | null> {
    try {
      const sponsorTree = await prisma.genealogyTree.findUnique({
        where: { userId: sponsorId },
        include: {
          user: true
        }
      });

      if (!sponsorTree) return null;

      // For matrix systems, find the first available spot
      // This is a simplified implementation
      const children = await prisma.genealogyTree.findMany({
        where: { sponsorId },
        select: { userId: true, position: true }
      });

      // Check for available positions (simplified 2x2 matrix)
      const positions = children.map(c => c.position);
      if (!positions.includes('1')) {
        return { placementId: sponsorId, position: '1' };
      }
      if (!positions.includes('2')) {
        return { placementId: sponsorId, position: '2' };
      }

      // If sponsor is full, spill over to first available child
      for (const child of children) {
        const spillover = await this.findSpilloverPlacement(child.userId);
        if (spillover) return spillover;
      }

      return null; // Network is full
    } catch (error) {
      logger.error('Error finding spillover placement:', error);
      throw error;
    }
  }
}