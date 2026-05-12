import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';

/**
 * GET /api/super-admin/intelligence/dashboard
 * Global intelligence dashboard data (God's Eyes overview)
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const [systemHealth, riskProfiles, activeEmergencies, tenantMetrics] = await Promise.all([
        superAdminService.getSystemHealth(),
        superAdminService.getRiskProfiles({ limit: 10 }),
        prisma.emergencyEvent.count({ where: { status: 'active' } }),
        prisma.tenantAnalytics.groupBy({
          by: ['metricType'],
          _avg: { value: true },
          _max: { value: true }
        })
      ]);

      return NextResponse.json({
        systemHealth,
        topRisks: riskProfiles,
        activeEmergencies,
        tenantPerformance: tenantMetrics
      });
    } catch (error) {
      console.error('Intelligence dashboard error:', error);
      return NextResponse.json(
        { error: 'Failed to load dashboard data' },
        { status: 500 }
      );
    }
  })(request);
}
