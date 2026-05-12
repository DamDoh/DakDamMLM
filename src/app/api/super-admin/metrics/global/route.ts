import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/metrics/global
 * Get global system metrics for God's Eyes
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const metricName = searchParams.get('metricName');
      const limit = parseInt(searchParams.get('limit') || '1000');

      const where: any = {};
      if (metricName) where.metricName = metricName;

      const metrics = await prisma.globalMetric.findMany({
        where,
        orderBy: { collectedAt: 'desc' },
        take: Math.min(limit, 10000) // cap at 10k
      });

      // Aggregate stats
      const stats = await prisma.globalMetric.groupBy({
        by: ['metricName'],
        _avg: { value: true },
        _max: { value: true },
        _min: { value: true }
      });

      return NextResponse.json({
        metrics,
        stats
      });
    } catch (error) {
      console.error('Get global metrics error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve global metrics' },
        { status: 500 }
      );
    }
  })(request);
}
