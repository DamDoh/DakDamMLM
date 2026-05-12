import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';

/**
 * POST /api/super-admin/config/features
 * Toggle feature flags
 */
export async function POST(request: NextRequest) {
  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { featureKey, enabled, targetTenants } = body;

      if (!featureKey || typeof enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Missing required fields: featureKey, enabled' },
          { status: 400 }
        );
      }

      const result = await superAdminService.updateGlobalConfig({
        key: `feature_${featureKey}`,
        value: { enabled, targetTenants },
        superAdminId: req.user!.id
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to toggle feature' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Feature '${featureKey}' ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error('Toggle feature error:', error);
      return NextResponse.json(
        { error: 'Failed to toggle feature flag' },
        { status: 500 }
      );
    }
  })(request);
}
