import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/iam/users
 * List all super admin users with their roles
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const superAdminUsers = await prisma.superAdminUser.findMany({
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, memberId: true }
          },
          role: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({
        users: superAdminUsers.map(sa => ({
          id: sa.id,
          userId: sa.userId,
          user: sa.user,
          role: sa.role,
          mfaEnabled: sa.mfaEnabled,
          lastLogin: sa.lastLogin,
          createdAt: sa.createdAt
        }))
      });
    } catch (error) {
      console.error('Get super admin users error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve super admin users' },
        { status: 500 }
      );
    }
  })(request);
}
