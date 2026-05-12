import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';

/**
 * POST /api/super-admin/compliance/reports/generate
 * Generate compliance report (GDPR, SOC2, HIPAA)
 */
export async function POST(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const body = await request.json();
      const { companyId, reportType, periodStart, periodEnd } = body;

      const allowedTypes = ['GDPR', 'SOC2', 'HIPAA'];
      if (!allowedTypes.includes(reportType)) {
        return NextResponse.json(
          { error: `Invalid report type. Must be one of: ${allowedTypes.join(', ')}` },
          { status: 400 }
        );
      }

      if (!periodStart || !periodEnd) {
        return NextResponse.json(
          { error: 'Missing required date fields: periodStart, periodEnd' },
          { status: 400 }
        );
      }

      const result = await superAdminService.generateComplianceReport({
        companyId,
        reportType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd)
      });

      return NextResponse.json({
        success: true,
        reportId: result.reportId,
        status: result.status,
        message: 'Compliance report generation started'
      });
    } catch (error) {
      console.error('Generate compliance report error:', error);
      return NextResponse.json(
        { error: 'Failed to generate compliance report' },
        { status: 500 }
      );
    }
  })(request);
}
