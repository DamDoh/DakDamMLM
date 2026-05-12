import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { notificationService } from '@/services/notification-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type')?.split(',');
    const priority = searchParams.get('priority')?.split(',');
    const category = searchParams.get('category')?.split(',');
    const acknowledged = searchParams.get('acknowledged') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const filter = {
      userId: user.id,
      companyId: user.companyId,
      type,
      priority,
      category,
      acknowledged,
      limit
    };

    const notifications = await notificationService.getNotifications(filter);

    return NextResponse.json({
      success: true,
      notifications
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Notifications fetch error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
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

    const { action, notificationId } = body;

    if (action === 'acknowledge' && notificationId) {
      const success = await notificationService.acknowledgeNotification(notificationId, user.id);

      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Notification acknowledged'
        });
      } else {
        return NextResponse.json(
          { error: 'Failed to acknowledge notification' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Notifications action error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function PUT(request: NextRequest) {
  try {
    const healthResult = await notificationService.performHealthCheck();

    return NextResponse.json({
      success: true,
      health: healthResult
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Health check error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\notifications\route.ts