import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/database';
import { CorporatePermissionService } from '@/services/corporate/permission-service';
import { logger } from '@/lib/logger';

// GET /api/corporate/shareholders - Get shareholders for a company
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

    // Check if user has permission to view shareholders
    const permission = await CorporatePermissionService.checkPermission({
      userId: session.user.id,
      companyId,
      action: 'view_financials'
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get shareholders with related data
    const shareholders = await prisma.shareholder.findMany({
      where: {
        companyId,
        status: 'active'
      },
      include: {
        boardMemberships: {
          where: { status: 'active' }
        },
        networkReferrals: {
          where: { status: 'active' },
          select: { id: true }
        },
        benefitLedgers: {
          where: {
            status: { in: ['processed', 'paid'] },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
          },
          select: {
            amount: true,
            transactionType: true
          }
        }
      },
      orderBy: { sharePercentage: 'desc' }
    });

    const formattedShareholders = shareholders.map(shareholder => ({
      id: shareholder.id,
      userId: shareholder.userId,
      membershipType: shareholder.membershipType,
      canBuildNetwork: shareholder.canBuildNetwork,
      sharePercentage: shareholder.sharePercentage,
      totalShares: shareholder.totalShares,
      investmentAmount: shareholder.investmentAmount,
      status: shareholder.status,
      votingRights: shareholder.votingRights,
      networkReferrals: shareholder.networkReferrals,
      boardMemberships: shareholder.boardMemberships,
      recentBenefits: shareholder.benefitLedgers.reduce((sum, ledger) => sum + ledger.amount, 0)
    }));

    return NextResponse.json({
      success: true,
      data: formattedShareholders
    });

  } catch (error) {
    logger.error('Shareholders API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}