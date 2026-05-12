import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/monitoring/health
 * System health dashboard data
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const health = await superAdminService.getSystemHealth();

      // Get recent high-latency metrics (anomalies)
      const recentAnomalies = await prisma.systemHealthMetric.findMany({
        where: {
          metricType: 'api_latency',
          value: { gte: 1000 } // >1 second is considered anomaly
        },
        orderBy: { timestamp: 'desc' },
        take: 20
      });

      return NextResponse.json({
        health,
        anomalies: recentAnomalies
      });
    } catch (error) {
      console.error('Get system health error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve system health' },
        { status: 500 }
      );
    }
  })(request);
}
