import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { authenticateRequest } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authenticatedRequest = await authenticateRequest(request);
    const currentUser = authenticatedRequest.user;

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { memberId, newParentId, newPosition, reason } = body;

    if (!memberId || !newParentId || !newPosition) {
      return NextResponse.json(
        { error: 'Member ID, new parent ID, and position are required' },
        { status: 400 }
      );
    }

    if (!['left', 'right'].includes(newPosition)) {
      return NextResponse.json(
        { error: 'Position must be either "left" or "right"' },
        { status: 400 }
      );
    }

    // Get current user's company
    const currentUserWithCompany = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { companyId: true }
    });

    if (!currentUserWithCompany?.companyId) {
      return NextResponse.json(
        { error: 'User is not associated with a company' },
        { status: 400 }
      );
    }

    // Get company rule config
    const companyConfig = await prisma.companyRuleConfig.findUnique({
      where: { companyId: currentUserWithCompany.companyId }
    });

    if (!(companyConfig as any)?.allowDownlineMovement) {
      return NextResponse.json(
        { error: 'Downline movement is not allowed for this company' },
        { status: 403 }
      );
    }

    // Get the member to be moved
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      include: {
        company: true
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    if (member.companyId !== currentUserWithCompany.companyId) {
      return NextResponse.json(
        { error: 'Member does not belong to your company' },
        { status: 403 }
      );
    }

    // Check if current user is authorized to move this member
    // User must be a sponsor/parent of the member in the genealogy tree
    const isAuthorized = await checkAuthorization(currentUser.id, memberId);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'You are not authorized to move this member' },
        { status: 403 }
      );
    }

    // Get the new parent
    const newParent = await prisma.user.findUnique({
      where: { id: newParentId },
      include: {
        company: true
      }
    });

    if (!newParent) {
      return NextResponse.json(
        { error: 'New parent not found' },
        { status: 404 }
      );
    }

    if (newParent.companyId !== currentUserWithCompany.companyId) {
      return NextResponse.json(
        { error: 'New parent does not belong to your company' },
        { status: 403 }
      );
    }

    // Check time limit
    const timeLimitHours = (companyConfig as any).movementTimeLimitHours || 24;
    const memberCreatedAt = new Date(member.createdAt);
    const hoursSinceCreation = (Date.now() - memberCreatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > timeLimitHours) {
      return NextResponse.json(
        { error: `Member can only be moved within ${timeLimitHours} hours of registration` },
        { status: 403 }
      );
    }

    // Check if new parent has space in the requested position
    const newParentChildren = newParent.children as { left: string | null; right: string | null };
    if (newParentChildren[newPosition as keyof typeof newParentChildren]) {
      return NextResponse.json(
        { error: `New parent already has a ${newPosition} child` },
        { status: 400 }
      );
    }

    // Get current parent
    const currentParent = await prisma.user.findUnique({
      where: { id: member.placementParentId! }
    });

    if (!currentParent) {
      return NextResponse.json(
        { error: 'Current parent not found' },
        { status: 404 }
      );
    }

    // Check if movement requires approval
    if ((companyConfig as any).movementRequiresApproval) {
      // Create pending movement request
      const movement = await (prisma as any).genealogyMovement.create({
        data: {
          memberId,
          companyId: currentUserWithCompany.companyId,
          movedBy: currentUser.id,
          fromParentId: member.placementParentId!,
          toParentId: newParentId,
          fromPosition: member.position!,
          toPosition: newPosition,
          movementReason: reason,
          status: 'pending'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Movement request submitted for approval',
        movementId: movement.id,
        status: 'pending'
      });
    }

    // Execute the movement immediately
    await executeMovement(member, currentParent, newParent, newPosition, currentUser.id, reason);

    return NextResponse.json({
      success: true,
      message: 'Member moved successfully'
    });

  } catch (error) {
    logger.error('Error moving downline:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json(
      { error: 'Failed to move downline' },
      { status: 500 }
    );
  }
}

async function checkAuthorization(moverId: string, memberId: string): Promise<boolean> {
  // Check if the mover is a direct sponsor/parent or higher in the genealogy tree
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { placementParentId: true, sponsorId: true }
  });

  if (!member) return false;

  // Direct parent check
  if (member.placementParentId === moverId || member.sponsorId === moverId) {
    return true;
  }

  // Check if mover is higher in the genealogy tree (recursive check)
  return await isAncestor(moverId, member.placementParentId!);
}

async function isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
  if (!descendantId) return false;

  // FIXED: Use iterative approach instead of recursion to prevent stack overflow
  // Also add depth limit and cycle detection for safety
  let currentId = descendantId;
  let depth = 0;
  const MAX_DEPTH = 50; // Prevent infinite loops
  const visited = new Set<string>(); // Detect cycles

  while (currentId && depth < MAX_DEPTH) {
    // Cycle detection
    if (visited.has(currentId)) {
      logger.warn('Cycle detected in genealogy tree', {
        ancestorId,
        descendantId,
        cycleNode: currentId
      });
      return false;
    }
    visited.add(currentId);

    const user = await prisma.user.findUnique({
      where: { id: currentId },
      select: { placementParentId: true }
    });

    if (!user || !user.placementParentId) return false;
    if (user.placementParentId === ancestorId) return true;

    currentId = user.placementParentId;
    depth++;
  }

  if (depth >= MAX_DEPTH) {
    logger.warn('Maximum genealogy depth exceeded during ancestor check', {
      ancestorId,
      descendantId,
      depth
    });
  }

  return false;
}

async function executeMovement(
  member: any,
  currentParent: any,
  newParent: any,
  newPosition: string,
  movedBy: string,
  reason?: string
) {
  // Update member's placement
  await prisma.user.update({
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

  await prisma.user.update({
    where: { id: currentParent.id },
    data: { children: currentParentChildren }
  });

  // Add to new parent's children
  const newParentChildren = newParent.children as { left: string | null; right: string | null };
  (newParentChildren as any)[newPosition] = member.id;

  await prisma.user.update({
    where: { id: newParent.id },
    data: { children: newParentChildren }
  });

  // Record the movement
  await (prisma as any).genealogyMovement.create({
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
}