import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/control/emergency/status
 * Get current emergency status
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const activeEmergencies = await prisma.emergencyEvent.findMany({
        where: { status: 'active' },
        orderBy: { declaredAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          severity: true,
          description: true,
          declaredAt: true,
          declaredBy: true,
          impactScope: true
        }
      });

      return NextResponse.json({
        active: activeEmergencies.length > 0,
        count: activeEmergencies.length,
        events: activeEmergencies
      });
    } catch (error) {
      console.error('Get emergency status error:', error);
      return NextResponse.json(
        { error: 'Failed to get emergency status' },
        { status: 500 }
      );
    }
  })(request);
}
