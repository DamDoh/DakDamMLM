import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FinancialDashboardService } from '@/services/corporate/financial-dashboard';
import { CorporatePermissionService } from '@/services/corporate/permission-service';
import { logger } from '@/lib/logger';

// GET /api/corporate/transactions - Get user's transaction history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100 per page
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

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

    const transactionHistory = await FinancialDashboardService.getTransactionHistory(
      session.user.id,
      companyId || undefined,
      {
        page,
        limit,
        type: type || undefined,
        status: status || undefined,
        startDate,
        endDate
      }
    );

    return NextResponse.json({
      success: true,
      data: transactionHistory
    });

  } catch (error) {
    logger.error('Transaction history API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}