import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';

/**
 * GET /api/super-admin/config/global
 * Get all global configurations
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const configs = await superAdminService.getGlobalConfig();

      return NextResponse.json({ configs });
    } catch (error) {
      console.error('Get global config error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve global configuration' },
        { status: 500 }
      );
    }
  })(request);
}
