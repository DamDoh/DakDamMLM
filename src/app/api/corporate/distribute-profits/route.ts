import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ProfitDistributionEngine } from '@/services/corporate/profit-distribution-engine';
import { CorporatePermissionService } from '@/services/corporate/permission-service';
import { logger } from '@/lib/logger';

// POST /api/corporate/distribute-profits - Trigger profit distribution
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyId,
      totalProfits,
      periodStart,
      periodEnd,
      distributionRules
    } = body;

    // Validate required fields
    if (!companyId || totalProfits === undefined || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user has permission to manage company (board member with executive powers)
    const permission = await CorporatePermissionService.checkPermission({
      userId: session.user.id,
      companyId,
      action: 'manage_company'
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions to distribute profits' }, { status: 403 });
    }

    // Validate total profits
    if (totalProfits <= 0) {
      return NextResponse.json({ error: 'Total profits must be positive' }, { status: 400 });
    }

    // Execute profit distribution
    const context = {
      companyId,
      totalProfits: Number(totalProfits),
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      distributionRules: distributionRules || undefined
    };

    const result = await ProfitDistributionEngine.distributeCompanyProfits(context);

    logger.info('Profit distribution triggered via API', {
      companyId,
      totalProfits,
      performedBy: session.user.id,
      result
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Profit distribution completed successfully'
    });

  } catch (error) {
    logger.error('Profit distribution API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/corporate/distribution-rules - Get default distribution rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // Check permissions
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

    // Return default distribution rules
    const defaultRules = {
      shareholderDividendPercentage: 0.6,  // 60% to shareholders
      networkBonusPercentage: 0.2,         // 20% to network bonuses
      governanceBonusPercentage: 0.1,      // 10% to board/governance
      reservePercentage: 0.1               // 10% to reserves
    };

    return NextResponse.json({
      success: true,
      data: defaultRules
    });

  } catch (error) {
    logger.error('Distribution rules API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}