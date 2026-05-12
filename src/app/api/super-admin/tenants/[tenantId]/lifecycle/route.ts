import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';
import { logger } from '@/lib/logger';

/**
 * PUT /api/super-admin/tenants/[tenantId]/lifecycle
 * Update tenant lifecycle state (suspend, resume, terminate)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const startTime = Date.now();

  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { action, reason } = body;

      if (!['suspend', 'resume', 'terminate'].includes(action)) {
        return NextResponse.json(
          { error: 'Invalid action. Must be suspend, resume, or terminate' },
          { status: 400 }
        );
      }

      const result = await superAdminService.updateTenantLifecycle({
        tenantId,
        action,
        reason,
        superAdminId: req.user!.id
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to update tenant lifecycle' },
          { status: 400 }
        );
      }

      const duration = Date.now() - startTime;
      logger.info('Tenant lifecycle updated', {
        tenantId,
        action,
        by: req.user!.email,
        duration
      });

      return NextResponse.json({
        success: true,
        message: `Tenant ${action}ed successfully`
      });
    } catch (error) {
      console.error('Tenant lifecycle error:', error);
      return NextResponse.json(
        { error: 'Failed to update tenant lifecycle' },
        { status: 500 }
      );
    }
  })(request);
}
