/**
 * CRITICAL FIX #2: Genealogy Integrity Service
 * 
 * Ensures binary tree integrity rules are enforced:
 * 1. Maximum 2 children per parent (binary constraint)
 * 2. Every user (except root) must have placementParentId
 * 3. Position must be 'left' or 'right' (never null)
 * 4. No circular references
 * 5. No orphaned users
 */

import { prisma } from '@/lib/prisma';

export class GenealogyIntegrityService {
  /**
   * Validate that a user can be placed under a parent
   * CRITICAL: Prevents breaking binary tree rules
   */
  static async validatePlacement(
    parentId: string,
    position: 'left' | 'right',
    userId?: string // Optional: for update validation
  ): Promise<{ valid: boolean; error?: string }> {
    // Validation 1: Position must be 'left' or 'right'
    if (position !== 'left' && position !== 'right') {
      return {
        valid: false,
        error: 'Invalid position. Must be "left" or "right"'
      };
    }

    // Validation 2: Parent must exist
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: { 
        id: true, 
        deleted: true,
        active: true
      }
    });

    if (!parent) {
      return {
        valid: false,
        error: 'Parent user not found'
      };
    }

    if (parent.deleted) {
      return {
        valid: false,
        error: 'Cannot place under deleted parent'
      };
    }

    // Validation 3: Check if position is already occupied
    const existingChild = await prisma.user.findFirst({
      where: {
        placementParentId: parentId,
        position: position,
        deleted: false,
        // Exclude self if updating
        ...(userId && { NOT: { id: userId } })
      }
    });

    if (existingChild) {
      return {
        valid: false,
        error: `Position "${position}" is already occupied under this parent`
      };
    }

    // Validation 4: Check for circular reference
    if (userId) {
      const wouldCreateCircle = await this.checkCircularReference(userId, parentId);
      if (wouldCreateCircle) {
        return {
          valid: false,
          error: 'Placement would create circular reference in genealogy tree'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if placing child under parent would create circular reference
   * Example: A -> B -> C, trying to place A under C (circular!)
   */
  static async checkCircularReference(
    childId: string,
    proposedParentId: string
  ): Promise<boolean> {
    const maxDepth = 100; // Prevent infinite loop
    let currentId = proposedParentId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (currentId === childId) {
        return true; // Circular reference found!
      }

      const user = await prisma.user.findUnique({
        where: { id: currentId },
        select: { placementParentId: true }
      });

      if (!user || !user.placementParentId) {
        break; // Reached root
      }

      currentId = user.placementParentId;
      depth++;
    }

    return false;
  }

  /**
   * Find next available position for automatic placement
   * CRITICAL: For spillover logic
   */
  static async findNextAvailablePosition(
    startParentId: string,
    preferredSide?: 'left' | 'right'
  ): Promise<{ parentId: string; position: 'left' | 'right' } | null> {
    const maxSearchDepth = 10;
    const queue: Array<{ id: string; depth: number }> = [{ id: startParentId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift()!;

      if (depth >= maxSearchDepth) {
        continue; // Don't search too deep
      }

      if (visited.has(currentId)) {
        continue; // Already checked
      }
      visited.add(currentId);

      // Check preferred side first
      if (preferredSide) {
        const validation = await this.validatePlacement(currentId, preferredSide);
        if (validation.valid) {
          return { parentId: currentId, position: preferredSide };
        }
      }

      // Check both positions
      const sides: Array<'left' | 'right'> = preferredSide === 'left' 
        ? ['left', 'right'] 
        : ['right', 'left'];

      for (const side of sides) {
        const validation = await this.validatePlacement(currentId, side);
        if (validation.valid) {
          return { parentId: currentId, position: side };
        }
      }

      // Add children to queue for next level search
      const children = await prisma.user.findMany({
        where: {
          placementParentId: currentId,
          deleted: false
        },
        select: { id: true }
      });

      children.forEach(child => {
        queue.push({ id: child.id, depth: depth + 1 });
      });
    }

    return null; // No available position found
  }

  /**
   * Get children count for a user
   * CRITICAL: Ensures binary constraint (max 2 children)
   */
  static async getChildrenCount(parentId: string): Promise<number> {
    return await prisma.user.count({
      where: {
        placementParentId: parentId,
        deleted: false
      }
    });
  }

  /**
   * Validate entire genealogy tree integrity
   * Use for periodic audits
   */
  static async auditGenealogyIntegrity(companyId?: string): Promise<{
    valid: boolean;
    errors: Array<{ userId: string; issue: string }>;
  }> {
    const errors: Array<{ userId: string; issue: string }> = [];

    // Check 1: Users with more than 2 children (violates binary)
    const usersWithTooManyChildren = await prisma.$queryRaw<Array<{ placement_parent_id: string; count: number }>>`
      SELECT placement_parent_id, COUNT(*) as count
      FROM users
      WHERE placement_parent_id IS NOT NULL
        AND deleted = false
        ${companyId ? prisma.$queryRawUnsafe(`AND company_id = '${companyId}'`) : prisma.$queryRawUnsafe('')}
      GROUP BY placement_parent_id
      HAVING COUNT(*) > 2
    `;

    usersWithTooManyChildren.forEach(row => {
      errors.push({
        userId: row.placement_parent_id,
        issue: `Has ${row.count} children (max 2 allowed in binary tree)`
      });
    });

    // Check 2: Users with same parent and position (duplicates)
    const duplicatePositions = await prisma.$queryRaw<Array<{ placement_parent_id: string; position: string; count: number }>>`
      SELECT placement_parent_id, position, COUNT(*) as count
      FROM users
      WHERE placement_parent_id IS NOT NULL
        AND deleted = false
        ${companyId ? prisma.$queryRawUnsafe(`AND company_id = '${companyId}'`) : prisma.$queryRawUnsafe('')}
      GROUP BY placement_parent_id, position
      HAVING COUNT(*) > 1
    `;

    duplicatePositions.forEach(row => {
      errors.push({
        userId: row.placement_parent_id,
        issue: `Multiple users in ${row.position} position (${row.count} users)`
      });
    });

    // Check 3: Users with invalid positions
    const invalidPositions = await prisma.user.findMany({
      where: {
        placementParentId: { not: null },
        position: { notIn: ['left', 'right'] },
        deleted: false,
        ...(companyId && { companyId })
      },
      select: { id: true, position: true }
    });

    invalidPositions.forEach(user => {
      errors.push({
        userId: user.id,
        issue: `Invalid position: "${user.position}" (must be "left" or "right")`
      });
    });

    // Check 4: Users without parent (except root)
    const orphanedUsers = await prisma.user.findMany({
      where: {
        placementParentId: null,
        sponsorId: { not: null }, // Has sponsor but no parent = orphan
        deleted: false,
        ...(companyId && { companyId })
      },
      select: { id: true, memberId: true }
    });

    orphanedUsers.forEach(user => {
      errors.push({
        userId: user.id,
        issue: `Orphaned user: has sponsor but no placement parent`
      });
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Fix orphaned users by placing them automatically
   */
  static async fixOrphanedUsers(companyId?: string): Promise<number> {
    const orphans = await prisma.user.findMany({
      where: {
        placementParentId: null,
        sponsorId: { not: null },
        deleted: false,
        ...(companyId && { companyId })
      },
      select: { id: true, sponsorId: true }
    });

    let fixed = 0;

    for (const orphan of orphans) {
      try {
        // Try to place under sponsor
        const placement = await this.findNextAvailablePosition(orphan.sponsorId!);
        
        if (placement) {
          await prisma.user.update({
            where: { id: orphan.id },
            data: {
              placementParentId: placement.parentId,
              position: placement.position
            }
          });
          fixed++;
        }
      } catch (error) {
        console.error(`Failed to fix orphan ${orphan.id}:`, error);
      }
    }

    return fixed;
  }
}
