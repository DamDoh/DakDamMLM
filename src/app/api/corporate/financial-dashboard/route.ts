import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FinancialDashboardService } from '@/services/corporate/financial-dashboard';
import { CorporatePermissionService } from '@/services/corporate/permission-service';
import { logger } from '@/lib/logger';

// GET /api/corporate/financial-dashboard - Get user's financial dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const timeRange = searchParams.get('timeRange') as 'month' | 'quarter' | 'year' || 'month';

    // Check if user has permission to view financials
    if (companyId) {
      const permission = await CorporatePermissionService.checkPermission({
        userId: session.user.id,
        companyId,
        action: 'view_financials'
      });

      if (!permission.allowed) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    const dashboardData = await FinancialDashboardService.getFinancialDashboard(
      session.user.id,
      companyId || undefined,
      timeRange
    );

    if (!dashboardData) {
      return NextResponse.json({ error: 'Financial data not available' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Financial dashboard API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}