import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/iam/roles
 * List all super admin roles and permissions
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const roles = await prisma.superAdminRole.findMany({
        where: { isActive: true },
        orderBy: { level: 'asc' },
        include: {
          _count: { select: { users: true } }
        }
      });

      return NextResponse.json({
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
          level: role.level,
          description: role.description,
          permissions: role.permissions,
          restrictions: role.restrictions,
          userCount: role._count.users,
          createdAt: role.createdAt
        }))
      });
    } catch (error) {
      console.error('Get super admin roles error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve roles' },
        { status: 500 }
      );
    }
  })(request);
}
