import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { RBACService } from '@/services/rbac-service';

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Get userId from query params or use authenticated user
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Only allow users to get their own scopes, or require admin permission
    if (userId !== user.id) {
      // Check if user is super admin
      const userRoles = await RBACService.getUserWithRoles(user.id);
      const isSuperAdmin = userRoles?.roles?.some(role => role.name === 'super_admin') ?? false;
      
      if (!isSuperAdmin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get admin scopes
    const scopes = await RBACService.getAdminScopes(userId);

    console.log(`📋 Admin scopes for user ${userId}:`, scopes);

    return NextResponse.json({
      success: true,
      scopes: scopes || []
    });
  } catch (error: any) {
    console.error('Failed to get admin scopes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get admin scopes' },
      { status: 500 }
    );
  }
}

