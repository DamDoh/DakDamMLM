import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';

/**
 * POST /api/super-admin/governance/rules/[id]/execute
 * Manually trigger governance rule execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return requireSuperAdmin(async () => {
    try {
      const result = await superAdminService.executeGovernanceRule(id);

      if (!result.success) {
        return NextResponse.json(
          { error: 'Failed to execute rule. Rule may not exist or be inactive.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        actionsTaken: result.actionsTaken,
        message: `Rule executed successfully with ${result.actionsTaken.length} actions`
      });
    } catch (error) {
      console.error('Execute governance rule error:', error);
      return NextResponse.json(
        { error: 'Failed to execute governance rule' },
        { status: 500 }
      );
    }
  })(request);
}
