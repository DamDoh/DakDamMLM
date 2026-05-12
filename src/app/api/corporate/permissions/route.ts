import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { CorporatePermissionService } from '@/services/corporate/permission-service';
import { logger } from '@/lib/logger';

// POST /api/corporate/validate-permission - Validate user permissions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, action, resource } = body;

    // Validate required fields
    if (!companyId || !action) {
      return NextResponse.json({ error: 'Missing required fields: companyId, action' }, { status: 400 });
    }

    const permission = await CorporatePermissionService.checkPermission({
      userId: session.user.id,
      companyId,
      action,
      resource
    });

    return NextResponse.json({
      success: true,
      data: permission
    });

  } catch (error) {
    logger.error('Permission validation API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/corporate/profile - Get user's corporate profile
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId parameter required' }, { status: 400 });
    }

    const profile = await CorporatePermissionService.getUserCorporateProfile(
      session.user.id,
      companyId
    );

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error) {
    logger.error('Corporate profile API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}