import { NextRequest } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

/**
 * Helper: Recursively collect all downline members from binary tree
 */
async function collectDownlineMembers(userId: string, visited = new Set<string>()): Promise<any[]> {
  if (visited.has(userId)) {
    return [];
  }
  visited.add(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      memberId: true,
      storeOwnerLevel: true,
      children: true
    }
  });

  if (!user) {
    return [];
  }

  const members: any[] = [];
  const children = user.children as any;

  // Process left child
  if (children?.left && !visited.has(children.left)) {
    const leftUser = await prisma.user.findUnique({
      where: { id: children.left },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        storeOwnerLevel: true,
        children: true
      }
    });

    if (leftUser) {
      // Only include members who don't have a stockist level (S, M, C, D)
      // Regular members only (no stockist level)
      if (!leftUser.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(leftUser.storeOwnerLevel)) {
        members.push({
          id: leftUser.id,
          fullName: leftUser.fullName,
          memberId: leftUser.memberId,
          storeOwnerLevel: leftUser.storeOwnerLevel,
          firstName: leftUser.fullName.split(' ')[0] || '',
          surname: leftUser.fullName.split(' ').slice(1).join(' ') || ''
        });
      }

      // Recursively collect from left subtree
      const leftDownline = await collectDownlineMembers(children.left, visited);
      members.push(...leftDownline);
    }
  }

  // Process right child
  if (children?.right && !visited.has(children.right)) {
    const rightUser = await prisma.user.findUnique({
      where: { id: children.right },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        storeOwnerLevel: true,
        children: true
      }
    });

    if (rightUser) {
      // Only include members who don't have a stockist level (S, M, C, D)
      // Regular members only (no stockist level)
      if (!rightUser.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(rightUser.storeOwnerLevel)) {
        members.push({
          id: rightUser.id,
          fullName: rightUser.fullName,
          memberId: rightUser.memberId,
          storeOwnerLevel: rightUser.storeOwnerLevel,
          firstName: rightUser.fullName.split(' ')[0] || '',
          surname: rightUser.fullName.split(' ').slice(1).join(' ') || ''
        });
      }

      // Recursively collect from right subtree
      const rightDownline = await collectDownlineMembers(children.right, visited);
      members.push(...rightDownline);
    }
  }

  return members;
}

/**
 * GET /api/members/downline
 * Get all downline members in the binary tree
 */
export async function GET(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;

      logger.info('Fetching downline members', {
        userId: authUser.id
      }, req);

      const downlineMembers = await collectDownlineMembers(authUser.id);

      logger.info('Downline members fetched', {
        userId: authUser.id,
        count: downlineMembers.length
      }, req);

      return ApiResponseUtil.success(downlineMembers);

    } catch (error) {
      logger.error('Failed to fetch downline members', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, req);
      return ApiResponseUtil.error('Failed to fetch downline members');
    }
  })(request);
}

