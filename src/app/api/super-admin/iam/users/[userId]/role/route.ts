import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

/**
 * POST /api/super-admin/iam/users/[userId]/role
 * Assign a super admin role to a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { roleId } = body;

      if (!roleId) {
        return NextResponse.json(
          { error: 'Role ID is required' },
          { status: 400 }
        );
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if already has a super admin profile
      const existing = await prisma.superAdminUser.findUnique({
        where: { userId }
      });

      if (existing) {
        // Update role
        await prisma.superAdminUser.update({
          where: { userId },
          data: { roleId, isActive: true }
        });
      } else {
        // Create new super admin user record
        await prisma.superAdminUser.create({
          data: {
            userId,
            roleId,
            isActive: true,
            mfaEnabled: true
          }
        });
      }

      // Audit log
      await prisma.superAdminAuditLog.create({
        data: {
          superAdminId: req.user!.id,
          action: 'assign_super_admin_role',
          entityType: 'super_admin_user',
          entityId: userId,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent'),
          metadata: { roleId }
        }
      });

      const duration = Date.now() - req.startTime;
      logger.info('Super admin role assigned', {
        userId,
        roleId,
        assignedBy: req.user!.email,
        duration
      }, request);

      return NextResponse.json({
        success: true,
        message: 'Super admin role assigned successfully'
      });
    } catch (error) {
      console.error('Assign role error:', error);
      return NextResponse.json(
        { error: 'Failed to assign role' },
        { status: 500 }
      );
    }
  })(request);
}
