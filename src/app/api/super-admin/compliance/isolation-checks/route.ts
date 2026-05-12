import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/compliance/isolation-checks
 * Get data isolation verification status
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const checks = await prisma.isolationCheck.findMany({
        orderBy: { scheduledAt: 'desc' },
        take: 100
      });

      return NextResponse.json({ checks });
    } catch (error) {
      console.error('Get isolation checks error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve isolation checks' },
        { status: 500 }
      );
    }
  })(request);
}
