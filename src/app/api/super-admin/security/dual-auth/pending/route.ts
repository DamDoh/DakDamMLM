import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/security/dual-auth/pending
 * List pending dual authorization requests
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const pending = await prisma.dualAuthorizationRequest.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        include: {
          requestedByUser: {
            select: { email: true, fullName: true }
          }
        }
      });

      return NextResponse.json({
        pending: pending.length,
        requests: pending.map(req => ({
          id: req.id,
          actionType: req.actionType,
          requestData: req.requestData,
          riskLevel: req.riskLevel,
          requestedBy: req.requestedBy,
          requestedByUser: req.requestedByUser,
          approvalDeadline: req.approvalDeadline,
          createdAt: req.createdAt
        }))
      });
    } catch (error) {
      console.error('Get pending dual auth error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve pending requests' },
        { status: 500 }
      );
    }
  })(request);
}
