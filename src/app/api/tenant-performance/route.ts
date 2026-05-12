import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { tenantPerformanceService } from '@/services/tenant-performance-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin/super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || user.accountType !== 'SuperAdmin') {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (companyId) {
      // Get specific tenant metrics
      const metrics = await tenantPerformanceService.getTenantMetrics(companyId);
      const quota = await tenantPerformanceService.getTenantQuota(companyId);

      if (!metrics || !quota) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        tenant: { metrics, quota }
      });
    } else {
      // Get all tenant performance data
      const performanceData = await tenantPerformanceService.getAllTenantPerformance();

      return NextResponse.json({
        success: true,
        performance: performanceData
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Tenant performance API error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify user is authenticated and is super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || user.accountType !== 'SuperAdmin') {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { companyId, quotaUpdates } = body;

    if (!companyId || !quotaUpdates) {
      return NextResponse.json(
        { error: 'companyId and quotaUpdates are required' },
        { status: 400 }
      );
    }

    await tenantPerformanceService.updateTenantQuota(companyId, quotaUpdates);

    logger.info('Tenant quota updated', {
      companyId,
      updates: quotaUpdates,
      updatedBy: user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Tenant quota updated successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Tenant quota update error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\tenant-performance\route.ts