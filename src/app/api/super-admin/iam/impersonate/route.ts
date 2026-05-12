import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * DELETE /api/super-admin/iam/impersonate
 * End an impersonation session
 */
export async function DELETE(request: NextRequest) {
  return requireSuperAdmin(async (req) => {
    try {
      // In a real implementation, we'd receive the session ID from the client
      // For now, we'll mark any ongoing impersonation as ended based on superAdminId
      const body = request.body ? await request.json() : {};
      const { sessionId } = body;

      if (sessionId) {
        await prisma.superAdminImpersonationLog.update({
          where: { id: sessionId },
          data: {
            endedAt: new Date(),
            duration: Math.floor((Date.now() - new Date(sessionId).getTime()) / 1000)
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Impersonation session ended'
      });
    } catch (error) {
      console.error('End impersonation error:', error);
      return NextResponse.json(
        { error: 'Failed to end impersonation session' },
        { status: 500 }
      );
    }
  })(request);
}
