import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { authenticateRequest } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const notificationUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  readDate: z.string().datetime().optional()
}).strict(); // Strict mode - only allow these fields

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for notification update', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request and extract user
    const authenticatedRequest = await authenticateRequest(request);
    const user = authenticatedRequest.user!;
    const { id } = await params;
    const body = await request.json();

    // Validate update data
    const validatedData = notificationUpdateSchema.parse(body);

    // Check notification exists and belongs to user
    const existingNotification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Users can only update their own notifications
    if (existingNotification.memberId !== user.id) {
      return NextResponse.json(
        { error: 'You can only update your own notifications' },
        { status: 403 }
      );
    }

    // Prepare update data with business logic
    const updateData: any = {};
    
    if (validatedData.isRead !== undefined) {
      updateData.isRead = validatedData.isRead;
      
      // Auto-set readDate when marking as read
      if (validatedData.isRead && !existingNotification.readDate) {
        updateData.readDate = new Date();
      }
      
      // Clear readDate when marking as unread
      if (!validatedData.isRead) {
        updateData.readDate = null;
      }
    }

    // Allow manual readDate override if provided
    if (validatedData.readDate) {
      updateData.readDate = new Date(validatedData.readDate);
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: updateData
    });

    logger.info('Notification updated', {
      userId: user.id,
      notificationId: id,
      isRead: updatedNotification.isRead,
      duration: Date.now() - startTime
    }, request);

    return NextResponse.json({
      success: true,
      data: updatedNotification,
      message: 'Notification updated successfully'
    });

  } catch (error) {
    let notificationId: string | undefined;
    try {
      const resolvedParams = await params;
      notificationId = resolvedParams.id;
    } catch {
      // If params can't be resolved, continue without id
    }
    logger.error('Failed to update notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      notificationId,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors,
          message: 'Only isRead and readDate fields can be updated'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}