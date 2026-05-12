import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

/**
 * PUT /api/super-admin/security/dual-auth/[id]/approve
 * Approve a dual authorization request
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return requireSuperAdmin(async (req) => {
    try {
      const authRequest = req.user;
      const approverId = authRequest!.id;

      const dualAuthRequest = await prisma.dualAuthorizationRequest.findUnique({
        where: { id }
      });

      if (!dualAuthRequest) {
        return NextResponse.json(
          { error: 'Dual authorization request not found' },
          { status: 404 }
        );
      }

      if (dualAuthRequest.status !== 'pending') {
        return NextResponse.json(
          { error: `Request already ${dualAuthRequest.status}` },
          { status: 400 }
        );
      }

      if (dualAuthRequest.requestedBy === approverId) {
        return NextResponse.json(
          { error: 'Cannot approve your own request' },
          { status: 400 }
        );
      }

      // Check deadline
      if (dualAuthRequest.approvalDeadline < new Date()) {
        await prisma.dualAuthorizationRequest.update({
          where: { id },
          data: { status: 'expired' }
        });
        return NextResponse.json(
          { error: 'Approval deadline has passed' },
          { status: 400 }
        );
      }

      // Approve
      await prisma.dualAuthorizationRequest.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy: approverId,
          approvedAt: new Date()
        }
      });

      // Audit
      await prisma.superAdminAuditLog.create({
        data: {
          superAdminId: approverId,
          action: 'dual_auth_approve',
          entityType: 'dual_authorization_request',
          entityId: id,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent'),
          metadata: { requestData: dualAuthRequest.requestData }
        }
      });

      logger.info('Dual auth request approved', {
        requestId: id,
        approvedBy: authRequest!.email,
        actionType: dualAuthRequest.actionType
      }, request);

      return NextResponse.json({
        success: true,
        message: 'Request approved successfully'
      });
    } catch (error) {
      console.error('Approve dual auth error:', error);
      return NextResponse.json(
        { error: 'Failed to approve request' },
        { status: 500 }
      );
    }
  })(request);
}
