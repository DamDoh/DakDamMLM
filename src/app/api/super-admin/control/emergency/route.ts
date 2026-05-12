import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { superAdminService } from '@/services/super-admin-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/super-admin/control/emergency
 * Declare emergency state (God's Intervention)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { eventType, severity, description, details } = body;

      if (!eventType || !severity || !description) {
        return NextResponse.json(
          { error: 'Missing required fields: eventType, severity, description' },
          { status: 400 }
        );
      }

      const result = await superAdminService.declareEmergency({
        eventType,
        severity,
        description,
        details,
        declaredBy: req.user!.id
      });

      const duration = Date.now() - startTime;
      logger.warn('Emergency declared', {
        eventType,
        severity,
        eventId: result.eventId,
        by: req.user!.email,
        duration
      });

      return NextResponse.json({
        success: true,
        eventId: result.eventId,
        message: 'Emergency state declared'
      });
    } catch (error) {
      console.error('Emergency declaration error:', error);
      return NextResponse.json(
        { error: 'Failed to declare emergency' },
        { status: 500 }
      );
    }
  })(request);
}
