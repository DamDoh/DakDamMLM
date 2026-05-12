import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/services/settings/settings-service';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

// GET /api/settings - Get all resolved settings for current context
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company context
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { companyId: true }
    });

    const context = {
      companyId: user?.companyId,
      userId: session.user.id
    };

    const settings = await SettingsService.getAllResolvedSettings(context);

    return NextResponse.json({
      success: true,
      data: settings,
      context
    });
  } catch (error) {
    logger.error('Error fetching settings', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings - Create or update a setting
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      level, // 'system', 'company', 'user'
      key,
      value,
      category,
      description,
      reason
    } = body;

    // Validate required fields
    if (!level || !key || value === undefined || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's company context
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { companyId: true, isAdmin: true }
    });

    // Check permissions based on level
    if (level === 'system' && !user?.isAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions for system settings' }, { status: 403 });
    }

    if (level === 'company' && (!user?.companyId || !user?.isAdmin)) {
      return NextResponse.json({ error: 'Insufficient permissions for company settings' }, { status: 403 });
    }

    const metadata = {
      category,
      description,
      reason,
      performedBy: session.user.id,
      companyId: level === 'company' ? user?.companyId : undefined,
      userId: level === 'user' ? session.user.id : undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent')
    };

    await SettingsService.setSetting(level, key, value, metadata);

    return NextResponse.json({
      success: true,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    logger.error('Error updating setting', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}