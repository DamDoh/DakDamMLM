import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { transformUserToMember } from '@/lib/shared-utils';

/**
 * GET /api/members/[id]/downline
 * Get the downline structure (binary tree) for a specific member
 * Returns the member's binary tree with left and right legs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    // Get the member
    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        firstName: true,
        surname: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        rank: true,
        accountType: true,
        avatarUrl: true,
        createdAt: true,
        active: true,
        pv: true,
        teamSize: true,
        children: true,
        placementParentId: true,
        position: true,
        isAdmin: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    // Ensure the member exists and is not an admin
    if (member.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Cannot fetch downline for admin accounts' },
        { status: 403 }
      );
    }

    // Recursively build the downline tree
    const buildDownlineTree = async (memberId: string, maxDepth: number = 5, currentDepth: number = 0): Promise<any> => {
      if (currentDepth >= maxDepth) {
        return null;
      }

      try {
        const memberData = await prisma.user.findUnique({
          where: { id: memberId },
          select: {
            id: true,
            memberId: true,
            firstName: true,
            surname: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            rank: true,
            accountType: true,
            avatarUrl: true,
            createdAt: true,
            active: true,
            pv: true,
            teamSize: true,
            children: true,
            placementParentId: true,
            position: true,
          },
        });

        if (!memberData) {
          return null;
        }

        const transformedMember = transformUserToMember(memberData);
        const children = memberData.children as { left?: string | null; right?: string | null } | null;

        let leftChild = null;
        let rightChild = null;

        // children.left and children.right are user IDs (strings), not objects
        if (children?.left && typeof children.left === 'string') {
          leftChild = await buildDownlineTree(children.left, maxDepth, currentDepth + 1);
        }

        if (children?.right && typeof children.right === 'string') {
          rightChild = await buildDownlineTree(children.right, maxDepth, currentDepth + 1);
        }

        return {
          ...transformedMember,
          left: leftChild,
          right: rightChild,
          children: {
            left: children?.left || null,
            right: children?.right || null,
          },
        };
      } catch (error: any) {
        console.error(`Error building downline tree for member ${memberId}:`, error);
        // Return null to gracefully handle errors in recursion
        return null;
      }
    };

    const downlineTree = await buildDownlineTree(id, 5, 0);

    return NextResponse.json({
      success: true,
      data: downlineTree,
    });
  } catch (error: any) {
    console.error('Error fetching downline:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch downline' },
      { status: 500 }
    );
  }
}
