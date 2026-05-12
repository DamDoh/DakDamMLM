import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';

/**
 * PUT /api/super-admin/config/global/[key]
 * Update specific global configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { value, effectiveDate, expiryDate } = body;

      const result = await superAdminService.updateGlobalConfig({
        key,
        value,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        superAdminId: req.user!.id
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to update config' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Configuration '${key}' updated successfully`
      });
    } catch (error) {
      console.error('Update global config error:', error);
      return NextResponse.json(
        { error: 'Failed to update configuration' },
        { status: 500 }
      );
    }
  })(request);
}
