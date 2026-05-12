import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/super-admin/control/bulk-operations
 * Execute bulk operation across multiple tenants (God's Hands)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { commandType, parameters, requiresApproval } = body;

      if (!commandType || !parameters) {
        return NextResponse.json(
          { error: 'Missing required fields: commandType, parameters' },
          { status: 400 }
        );
      }

      const result = await superAdminService.executeBulkOperation({
        commandType,
        parameters,
        superAdminId: req.user!.id,
        requiresApproval
      });

      const duration = Date.now() - startTime;
      logger.info('Bulk operation executed', {
        commandType,
        commandId: result.commandId,
        status: result.status,
        by: req.user!.email,
        duration
      });

      return NextResponse.json({
        success: true,
        commandId: result.commandId,
        status: result.status,
        message: 'Bulk operation initiated'
      });
    } catch (error) {
      console.error('Bulk operation error:', error);
      return NextResponse.json(
        { error: 'Failed to execute bulk operation' },
        { status: 500 }
      );
    }
  })(request);
}
