import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  
  return requireSuperAdmin(async (authenticatedRequest) => {
  try {
    const { action } = await request.json();

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case 'approve':
        updateData = { status: 'approved', isSuspended: false };
        break;
      case 'suspend':
        updateData = { isSuspended: true };
        break;
      case 'unsuspend':
        updateData = { isSuspended: false };
        break;
      case 'reject':
        updateData = { status: 'rejected' };
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Simulate company action (since we don't have company table)
    // In real implementation, this would update the company record

    return NextResponse.json({
      success: true,
      message: `Company ${action} successfully`
    });

  } catch (error) {
    console.error('Super admin company action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform company action' },
      { status: 500 }
    );
  }
  })(request);
}