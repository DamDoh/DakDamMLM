// Genealogy Microservice - Prisma-based Tree Management
// Handles all genealogy tree operations, member placement, and tree compression

import { db } from '../shared/database';
import {
  ServiceErrorHandler,
  ResponseUtils,
  ValidationUtils,
  PerformanceUtils,
  CacheUtils,
  roundToDecimal,
  DateUtils
} from '../shared/utils';
import type { Member } from '../shared/types';
import { eventBus, EventTypes, DomainEventCreators } from '../shared/event-bus';

// Cache configuration for genealogy operations
const GENEALOGY_CONFIG = {
  cache: {
    treeData: 60000, // 1 minute
    memberData: 300000, // 5 minutes
    placement: 600000, // 10 minutes
  },
  tree: {
    maxDepth: 100,
    compressionThreshold: 90, // days
  },
};

export interface TreeNode extends Member {
  left: TreeNode | null;
  right: TreeNode | null;
  level: number;
  path: string;
}

export interface PlacementResult {
  success: boolean;
  parentId?: string;
  position?: 'left' | 'right';
  reason?: string;
}

export interface GenealogyStats {
  totalMembers: number;
  activeMembers: number;
  treeDepth: number;
  compressionCandidates: number;
  lastCompression?: string;
}

class GenealogyEngine {
  private cache = new Map<string, { data: any; expiry: number }>();

  // Cache management
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  // Get complete genealogy tree for a member
  async getGenealogyTree(memberId: string): Promise<TreeNode | null> {
    const cacheKey = `tree-${memberId}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    const timerId = PerformanceUtils.startTimer('getGenealogyTree');

    try {
      // Get all members for tree construction
      const allMembersData = await db.user.findMany({
        where: { active: true }
      });

      const allMembers = new Map<string, Member>();
      allMembersData.forEach(member => {
        allMembers.set(member.id, {
          id: member.id,
          memberId: member.memberId || '',
          firstName: member.firstName,
          surname: member.surname,
          fullName: member.fullName,
          email: member.email,
          avatarUrl: member.avatarUrl || '/images/default-avatar.png',
          rank: member.rank as any,
          storeOwnerLevel: member.storeOwnerLevel as any,
          accountType: 'Distributor',
          pv: member.pv,
          pvDate: member.pvDate?.toString() || undefined,
          teamSize: (member.teamSize as any) || { left: 0, right: 0, total: 0 },
          joinDate: member.createdAt.toISOString(),
          sponsorId: member.sponsorId,
          placementParentId: member.placementParentId,
          position: member.position as any,
          children: (member.children as any) || { left: null, right: null },
          active: member.active,
          phoneNumber: member.phoneNumber,
          lastActivityDate: member.lastActivityDate?.toString() || undefined,
          isAdmin: member.isAdmin,
          addresses: (member.addresses as any) || [],
        } as Member);
      });

      const tree = await this.buildTree(memberId, allMembers, 0, '');

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Genealogy: Tree built for ${memberId} in ${duration}ms`);

      this.setCachedData(cacheKey, tree, GENEALOGY_CONFIG.cache.treeData);
      return tree;
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to get genealogy tree:', error);
      throw ServiceErrorHandler.createError('GENEALOGY_ERROR', 'Failed to retrieve genealogy tree');
    }
  }

  // Build tree recursively
  private async buildTree(
    memberId: string,
    allMembers: Map<string, Member>,
    level: number,
    path: string
  ): Promise<TreeNode | null> {
    if (level > GENEALOGY_CONFIG.tree.maxDepth) {
      console.warn(`Tree depth exceeded for member ${memberId}`);
      return null;
    }

    const member = allMembers.get(memberId);
    if (!member) return null;

    const treeNode: TreeNode = {
      ...member,
      left: null,
      right: null,
      level,
      path,
    };

    // Build left subtree
    if (member.children.left) {
      const leftChild = await this.buildTree(
        member.children.left,
        allMembers,
        level + 1,
        `${path}L`
      );
      treeNode.left = leftChild;
    }

    // Build right subtree
    if (member.children.right) {
      const rightChild = await this.buildTree(
        member.children.right,
        allMembers,
        level + 1,
        `${path}R`
      );
      treeNode.right = rightChild;
    }

    return treeNode;
  }

  // Find optimal placement for new member
  async findOptimalPlacement(
    sponsorId: string,
    allMembers: Map<string, Member>
  ): Promise<PlacementResult> {
    const timerId = PerformanceUtils.startTimer('findOptimalPlacement');

    try {
      const sponsor = allMembers.get(sponsorId);
      if (!sponsor) {
        return { success: false, reason: 'Sponsor not found' };
      }

      // Try to place under sponsor first
      const sponsorPlacement = await this.findFirstAvailablePosition(sponsorId, allMembers);
      if (sponsorPlacement) {
        PerformanceUtils.endTimer(timerId);
        return {
          success: true,
          parentId: sponsorPlacement.parentId,
          position: sponsorPlacement.position,
        };
      }

      // If no space under sponsor, try upline
      let currentUplineId = sponsor.placementParentId;
      while (currentUplineId) {
        const upline = allMembers.get(currentUplineId);
        if (!upline) break;

        const uplinePlacement = await this.findFirstAvailablePosition(currentUplineId, allMembers);
        if (uplinePlacement) {
          PerformanceUtils.endTimer(timerId);
          return {
            success: true,
            parentId: uplinePlacement.parentId,
            position: uplinePlacement.position,
          };
        }

        currentUplineId = upline.placementParentId;
      }

      // Last resort: place under root
      const rootMembers = Array.from(allMembers.values()).filter(m => !m.placementParentId);
      if (rootMembers.length > 0) {
        const root = rootMembers[0];
        const rootPlacement = await this.findFirstAvailablePosition(root.id, allMembers);

        if (rootPlacement) {
          PerformanceUtils.endTimer(timerId);
          return {
            success: true,
            parentId: rootPlacement.parentId,
            position: rootPlacement.position,
          };
        }
      }

      PerformanceUtils.endTimer(timerId);
      return { success: false, reason: 'No available placement positions found' };
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to find optimal placement:', error);
      return { success: false, reason: 'Placement calculation failed' };
    }
  }

  // Find first available position in subtree
  async findFirstAvailablePosition(
    rootId: string,
    allMembers: Map<string, Member>
  ): Promise<{ parentId: string; position: 'left' | 'right' } | null> {
    const visited = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      const member = allMembers.get(currentId);

      if (member) {
        // Check for available positions
        if (!member.children.left) {
          return { parentId: currentId, position: 'left' };
        }
        if (!member.children.right) {
          return { parentId: currentId, position: 'right' };
        }

        // Add children to queue for BFS
        if (member.children.left) queue.push(member.children.left);
        if (member.children.right) queue.push(member.children.right);
      }
    }

    return null;
  }

  // Compress inactive branches of the tree
  async compressTree(): Promise<{ compressedCount: number; errors: number }> {
    const timerId = PerformanceUtils.startTimer('compressTree');

    let compressedCount = 0;
    let errorCount = 0;

    try {
      const inactiveThreshold = new Date();
      inactiveThreshold.setDate(inactiveThreshold.getDate() - GENEALOGY_CONFIG.tree.compressionThreshold);

      // Find inactive members
      const inactiveMembers = await db.user.findMany({
        where: {
          active: true,
          pv: 0,
          lastActivityDate: {
            lte: inactiveThreshold.toISOString()
          }
        }
      });

      if (inactiveMembers.length === 0) {
        PerformanceUtils.endTimer(timerId);
        return { compressedCount: 0, errors: 0 };
      }

      // Get all members for relationship mapping
      const allMembersData = await db.user.findMany();
      const allMembers = new Map<string, Member>();
      allMembersData.forEach(member => {
        allMembers.set(member.id, {
          id: member.id,
          memberId: member.memberId || '',
          firstName: member.firstName,
          surname: member.surname,
          fullName: member.fullName,
          email: member.email,
          avatarUrl: member.avatarUrl || '/images/default-avatar.png',
          rank: member.rank as any,
          storeOwnerLevel: member.storeOwnerLevel as any,
          accountType: 'Distributor', // Default value since not in Prisma schema
          pv: member.pv,
          pvDate: member.pvDate?.toString() || undefined,
          teamSize: (member.teamSize as any) || { left: 0, right: 0, total: 0 },
          joinDate: member.createdAt.toISOString(),
          sponsorId: member.sponsorId,
          placementParentId: member.placementParentId,
          position: member.position as any,
          children: (member.children as any) || { left: null, right: null },
          active: member.active,
          phoneNumber: member.phoneNumber,
          lastActivityDate: member.lastActivityDate?.toString() || undefined,
          isAdmin: member.isAdmin,
          addresses: (member.addresses as any) || [],
        } as Member);
      });

      // Process each inactive member
      for (const member of inactiveMembers) {
        const memberData = allMembers.get(member.id);
        if (!memberData) continue;

        const hasActiveDownline = (memberData.teamSize?.total || 0) > 0;

        if (hasActiveDownline) {
          const upline = memberData.placementParentId ? allMembers.get(memberData.placementParentId) : null;

          if (upline && upline.active) {
            // Move children to upline
            const updates = [];

            ['left', 'right'].forEach(pos => {
              const childId = memberData.children[pos as 'left' | 'right'];
              if (childId) {
                updates.push(
                  db.user.update({
                    where: { id: childId },
                    data: { placementParentId: upline.id }
                  })
                );
              }
            });

            // Remove member from original parent's children
            if (memberData.placementParentId) {
              updates.push(
                db.user.update({
                  where: { id: memberData.placementParentId },
                  data: {
                    [`children.${memberData.position}`]: null
                  } as any
                })
              );
            }

            // Mark member as compressed
            updates.push(
              db.user.update({
                where: { id: member.id },
                data: {
                  active: false,
                  teamSize: { left: 0, right: 0, total: 0 }
                }
              })
            );

            await db.$transaction(updates);
            compressedCount++;

            // Publish tree compression event
            await eventBus.publish(DomainEventCreators.userUpdated(member.id, {
              compressed: true,
              reason: 'Tree compression'
            }));
          } else {
            errorCount++;
          }
        } else {
          await db.user.update({
            where: { id: member.id },
            data: { active: false }
          });
          compressedCount++;
        }
      }

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Genealogy: Tree compression completed in ${duration}ms - ${compressedCount} compressed, ${errorCount} errors`);

      return { compressedCount, errors: errorCount };
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Error during tree compression:', error);
      return { compressedCount: 0, errors: 1 };
    }
  }

  // Get genealogy statistics
  async getGenealogyStats(): Promise<GenealogyStats> {
    const timerId = PerformanceUtils.startTimer('getGenealogyStats');

    try {
      const [totalMembers, activeMembers, treeDepth, compressionCandidates] = await Promise.all([
        db.user.count(),
        db.user.count({ where: { active: true } }),
        this.calculateTreeDepth(),
        this.getCompressionCandidates(),
      ]);

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Genealogy: Stats calculated in ${duration}ms`);

      return {
        totalMembers,
        activeMembers,
        treeDepth,
        compressionCandidates,
      };
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to get genealogy stats:', error);
      throw ServiceErrorHandler.createError('GENEALOGY_ERROR', 'Failed to calculate genealogy statistics');
    }
  }

  // Helper methods
  private async calculateTreeDepth(): Promise<number> {
    try {
      // Find root members
      const rootMembers = await db.user.findMany({
        where: {
          placementParentId: null
        }
      });

      let maxDepth = 0;

      for (const root of rootMembers) {
        const depth = await this.calculateSubtreeDepth(root.id, 0);
        maxDepth = Math.max(maxDepth, depth);
      }

      return maxDepth;
    } catch (error) {
      console.error('Failed to calculate tree depth:', error);
      return 0;
    }
  }

  private async calculateSubtreeDepth(memberId: string, currentDepth: number): Promise<number> {
    const member = await db.user.findUnique({
      where: { id: memberId }
    });

    if (!member) return currentDepth;

    const children = member.children as any;
    if (!children?.left && !children?.right) return currentDepth;

    let maxChildDepth = currentDepth;

    if (children.left) {
      maxChildDepth = Math.max(maxChildDepth, await this.calculateSubtreeDepth(children.left, currentDepth + 1));
    }
    if (children.right) {
      maxChildDepth = Math.max(maxChildDepth, await this.calculateSubtreeDepth(children.right, currentDepth + 1));
    }

    return maxChildDepth;
  }

  private async getCompressionCandidates(): Promise<number> {
    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - GENEALOGY_CONFIG.tree.compressionThreshold);

    return db.user.count({
      where: {
        active: true,
        pv: 0,
        lastActivityDate: {
          lte: inactiveThreshold.toISOString()
        }
      }
    });
  }

  // Update member in genealogy tree
  async updateMemberInTree(memberId: string, updates: Partial<Member>): Promise<void> {
    const timerId = PerformanceUtils.startTimer('updateMemberInTree');

    try {
      // Prepare update data, filtering out undefined values
      const updateData: any = {};
      if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
      if (updates.surname !== undefined) updateData.surname = updates.surname;
      if (updates.fullName !== undefined) updateData.fullName = updates.fullName;
      if (updates.rank !== undefined) updateData.rank = updates.rank;
      if (updates.pv !== undefined) updateData.pv = updates.pv;
      if (updates.active !== undefined) updateData.active = updates.active;
      if (updates.placementParentId !== undefined) updateData.placementParentId = updates.placementParentId;
      if (updates.position !== undefined) updateData.position = updates.position;

      updateData.updatedAt = new Date();

      await db.user.update({
        where: { id: memberId },
        data: updateData
      });

      // Clear related cache
      this.clearMemberCache(memberId);

      // Publish update event
      await eventBus.publish(DomainEventCreators.userUpdated(memberId, updates));

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Genealogy: Member ${memberId} updated in ${duration}ms`);
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to update member in tree:', error);
      throw ServiceErrorHandler.createError('GENEALOGY_ERROR', 'Failed to update member');
    }
  }

  // Cache management
  private clearMemberCache(memberId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key =>
      key.includes(memberId) || key.startsWith('tree-')
    );

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Genealogy movement functionality
  async moveDownline(request: GenealogyMovementRequest): Promise<GenealogyMovementResult> {
    const timerId = PerformanceUtils.startTimer('moveDownline');

    try {
      const { memberId, newParentId, newPosition, reason, movedBy, companyId } = request;

      // Get company rule config
      const companyConfig = await db.companyRuleConfig.findUnique({
        where: { companyId }
      });

      if (!(companyConfig as any)?.allowDownlineMovement) {
        return { success: false, error: 'Downline movement is not allowed for this company' };
      }

      // Get the member to be moved
      const member = await db.user.findUnique({
        where: { id: memberId },
        include: { company: true }
      });

      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      if (member.companyId !== companyId) {
        return { success: false, error: 'Member does not belong to your company' };
      }

      // Check authorization
      const isAuthorized = await this.checkMovementAuthorization(movedBy, memberId);
      if (!isAuthorized) {
        return { success: false, error: 'You are not authorized to move this member' };
      }

      // Check time limit
      const timeLimitHours = (companyConfig as any).movementTimeLimitHours || 24;
      const memberCreatedAt = new Date(member.createdAt);
      const hoursSinceCreation = (Date.now() - memberCreatedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreation > timeLimitHours) {
        return { success: false, error: `Member can only be moved within ${timeLimitHours} hours of registration` };
      }

      // Get new parent
      const newParent = await db.user.findUnique({
        where: { id: newParentId }
      });

      if (!newParent) {
        return { success: false, error: 'New parent not found' };
      }

      if (newParent.companyId !== companyId) {
        return { success: false, error: 'New parent does not belong to your company' };
      }

      // Check if new parent has space
      const newParentChildren = newParent.children as { left: string | null; right: string | null };
      if (newParentChildren[newPosition as keyof typeof newParentChildren]) {
        return { success: false, error: `New parent already has a ${newPosition} child` };
      }

      // Check if movement requires approval
      if ((companyConfig as any).movementRequiresApproval) {
        // Create pending movement request
        const movement = await (db as any).genealogyMovement.create({
          data: {
            memberId,
            companyId,
            movedBy,
            fromParentId: member.placementParentId!,
            toParentId: newParentId,
            fromPosition: member.position!,
            toPosition: newPosition,
            movementReason: reason,
            status: 'pending'
          }
        });

        PerformanceUtils.endTimer(timerId);
        return {
          success: true,
          movementId: movement.id,
          status: 'pending'
        };
      }

      // Execute movement immediately
      await this.executeMovement(member, newParent, newPosition, movedBy, reason);

      PerformanceUtils.endTimer(timerId);
      return { success: true, status: 'completed' };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Error moving downline:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async checkMovementAuthorization(moverId: string, memberId: string): Promise<boolean> {
    // Check if the mover is a direct sponsor/parent or higher in the genealogy tree
    const member = await db.user.findUnique({
      where: { id: memberId },
      select: { placementParentId: true, sponsorId: true }
    });

    if (!member) return false;

    // Direct parent check
    if (member.placementParentId === moverId || member.sponsorId === moverId) {
      return true;
    }

    // Check if mover is higher in the genealogy tree
    return await this.isAncestor(moverId, member.placementParentId!);
  }

  private async isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
    if (!descendantId) return false;

    const descendant = await db.user.findUnique({
      where: { id: descendantId },
      select: { placementParentId: true }
    });

    if (!descendant) return false;

    if (descendant.placementParentId === ancestorId) return true;

    return await this.isAncestor(ancestorId, descendant.placementParentId!);
  }

  private async executeMovement(
    member: any,
    newParent: any,
    newPosition: string,
    movedBy: string,
    reason?: string
  ) {
    // Get current parent
    const currentParent = await db.user.findUnique({
      where: { id: member.placementParentId! }
    });

    if (!currentParent) {
      throw new Error('Current parent not found');
    }

    // Update member's placement
    await db.user.update({
      where: { id: member.id },
      data: {
        placementParentId: newParent.id,
        position: newPosition
      }
    });

    // Remove from current parent's children
    const currentParentChildren = currentParent.children as { left: string | null; right: string | null };
    if (currentParentChildren.left === member.id) {
      currentParentChildren.left = null;
    } else if (currentParentChildren.right === member.id) {
      currentParentChildren.right = null;
    }

    await db.user.update({
      where: { id: currentParent.id },
      data: { children: currentParentChildren }
    });

    // Add to new parent's children
    const newParentChildren = newParent.children as { left: string | null; right: string | null };
    (newParentChildren as any)[newPosition] = member.id;

    await db.user.update({
      where: { id: newParent.id },
      data: { children: newParentChildren }
    });

    // Record the movement
    await (db as any).genealogyMovement.create({
      data: {
        memberId: member.id,
        companyId: member.companyId,
        movedBy,
        fromParentId: currentParent.id,
        toParentId: newParent.id,
        fromPosition: member.position,
        toPosition: newPosition,
        movementReason: reason,
        status: 'completed'
      }
    });

    // Clear cache
    this.clearMemberCache(member.id);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; cacheSize: number; timestamp: string }> {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        cacheSize: this.cache.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        cacheSize: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let genealogyEngineInstance: GenealogyEngine | null = null;

function getGenealogyEngine(): GenealogyEngine {
  if (!genealogyEngineInstance) {
    genealogyEngineInstance = new GenealogyEngine();
  }
  return genealogyEngineInstance;
}

// Server actions for API routes
export async function getGenealogyTreeServer(memberId: string): Promise<TreeNode | null> {
  try {
    const engine = getGenealogyEngine();
    return await engine.getGenealogyTree(memberId);
  } catch (error) {
    console.error('Failed to get genealogy tree:', error);
    return null;
  }
}

export async function findOptimalPlacementServer(sponsorId: string): Promise<PlacementResult> {
  try {
    const engine = getGenealogyEngine();

    // Get all members for placement calculation
    const allMembersData = await db.user.findMany();
    const allMembers = new Map<string, Member>();
    allMembersData.forEach(member => {
      allMembers.set(member.id, {
        id: member.id,
        memberId: member.memberId || '',
        firstName: member.firstName,
        surname: member.surname,
        fullName: member.fullName,
        email: member.email,
        avatarUrl: member.avatarUrl || '/images/default-avatar.png',
        rank: member.rank as any,
        storeOwnerLevel: member.storeOwnerLevel as any,
        accountType: 'Distributor',
        pv: member.pv,
        pvDate: member.pvDate?.toString() || undefined,
        teamSize: (member.teamSize as any) || { left: 0, right: 0, total: 0 },
        joinDate: member.createdAt.toISOString(),
        sponsorId: member.sponsorId,
        placementParentId: member.placementParentId,
        position: member.position as any,
        children: (member.children as any) || { left: null, right: null },
        active: member.active,
        phoneNumber: member.phoneNumber,
        lastActivityDate: member.lastActivityDate?.toString() || undefined,
        isAdmin: member.isAdmin,
        addresses: (member.addresses as any) || [],
      } as Member);
    });

    return await engine.findOptimalPlacement(sponsorId, allMembers);
  } catch (error) {
    console.error('Failed to find optimal placement:', error);
    return { success: false, reason: 'Placement calculation failed' };
  }
}

export async function compressTreeServer(): Promise<{ compressedCount: number; errors: number }> {
  try {
    const engine = getGenealogyEngine();
    return await engine.compressTree();
  } catch (error) {
    console.error('Failed to compress tree:', error);
    return { compressedCount: 0, errors: 1 };
  }
}

export async function getGenealogyStatsServer(): Promise<GenealogyStats> {
  try {
    const engine = getGenealogyEngine();
    return await engine.getGenealogyStats();
  } catch (error) {
    console.error('Failed to get genealogy stats:', error);
    throw error;
  }
}

export async function updateMemberInTreeServer(memberId: string, updates: Partial<Member>): Promise<void> {
  try {
    const engine = getGenealogyEngine();
    await engine.updateMemberInTree(memberId, updates);
  } catch (error) {
    console.error('Failed to update member in tree:', error);
    throw error;
  }
}

// Genealogy movement functions
export interface GenealogyMovementRequest {
  memberId: string;
  newParentId: string;
  newPosition: 'left' | 'right';
  reason?: string;
  movedBy: string;
  companyId: string;
}

export interface GenealogyMovementResult {
  success: boolean;
  movementId?: string;
  error?: string;
  status?: 'completed' | 'pending';
}

export async function moveDownlineServer(request: GenealogyMovementRequest): Promise<GenealogyMovementResult> {
  try {
    const engine = getGenealogyEngine();
    return await engine.moveDownline(request);
  } catch (error) {
    console.error('Failed to move downline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function getMovementHistoryServer(memberId: string): Promise<any[]> {
  try {
    const movements = await (db as any).genealogyMovement.findMany({
      where: {
        OR: [
          { memberId },
          { movedBy: memberId },
          { fromParentId: memberId },
          { toParentId: memberId }
        ]
      },
      include: {
        member: {
          select: { id: true, fullName: true, memberId: true }
        },
        mover: {
          select: { id: true, fullName: true, memberId: true }
        },
        fromParent: {
          select: { id: true, fullName: true, memberId: true }
        },
        toParent: {
          select: { id: true, fullName: true, memberId: true }
        },
        approver: {
          select: { id: true, fullName: true, memberId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return movements;
  } catch (error) {
    console.error('Failed to get movement history:', error);
    return [];
  }
}