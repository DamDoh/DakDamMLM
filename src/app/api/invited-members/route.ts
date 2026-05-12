import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { transformUserToMember } from '@/lib/shared-utils';

/**
 * GET /api/invited-members
 * Get all members directly invited by the current user (where sponsorId = current user's id)
 */
export async function GET(request: NextRequest) {
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

    // Get all members where sponsorId = current user's id (only non-admin members)
    const invitedMembers = await prisma.user.findMany({
      where: {
        sponsorId: user.id,
        deleted: false,
        isAdmin: false, // Only show member accounts, not admin accounts
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
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
      },
    });

    // Transform to Member format
    const members = invitedMembers.map(transformUserToMember);

    return NextResponse.json({
      success: true,
      data: members,
      count: members.length,
    });
  } catch (error: any) {
    console.error('Error fetching invited members:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invited members' },
      { status: 500 }
    );
  }
}
