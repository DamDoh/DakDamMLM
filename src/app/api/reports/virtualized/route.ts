import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || (!user.isAdmin && user.accountType !== 'SuperAdmin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const sortField = searchParams.get('sortField') || 'totalEarnings';
    const sortDirection = searchParams.get('sortDirection') || 'desc';
    const search = searchParams.get('search') || '';

    if (!reportType) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      );
    }

    let data: any[] = [];
    let totalCount = 0;

    const offset = page * pageSize;
    const orderBy: any = {};
    orderBy[sortField] = sortDirection;

    // Build where clause for search
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { memberId: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { surname: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Add company filter if not super admin
    if (user.companyId) {
      whereClause.companyId = user.companyId;
    }

    switch (reportType) {
      case 'commission':
        // Get commission report data
        const commissionData = await prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            memberId: true,
            firstName: true,
            surname: true,
            accountType: true,
            storeOwnerLevel: true,
            createdAt: true,
            lastActivityDate: true,
            active: true,
            _count: {
              select: {
                commissions: true
              }
            }
          },
          orderBy,
          skip: offset,
          take: pageSize + 1, // +1 to check if there are more
        });

        totalCount = await prisma.user.count({ where: whereClause });

        data = commissionData.slice(0, pageSize).map(user => ({
          id: user.id,
          memberId: user.memberId,
          fullName: `${user.firstName} ${user.surname}`,
          rank: user.storeOwnerLevel || user.accountType || 'Member',
          totalEarnings: 0, // Would calculate from commissions table
          totalPV: 0, // Would calculate from PV records
          joinDate: user.createdAt.toISOString(),
          lastActivity: user.lastActivityDate?.toISOString() || user.createdAt.toISOString(),
          status: user.active ? 'Active' : 'Inactive'
        }));

        break;

      case 'member-activity':
        // Get member activity report
        const activityData = await prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            memberId: true,
            firstName: true,
            surname: true,
            accountType: true,
            storeOwnerLevel: true,
            createdAt: true,
            lastActivityDate: true,
            active: true,
            _count: {
              select: {
                orders: true,
                commissions: true
              }
            }
          },
          orderBy,
          skip: offset,
          take: pageSize + 1,
        });

        totalCount = await prisma.user.count({ where: whereClause });

        data = activityData.slice(0, pageSize).map(user => ({
          id: user.id,
          memberId: user.memberId,
          fullName: `${user.firstName} ${user.surname}`,
          rank: user.storeOwnerLevel || user.accountType || 'Member',
          totalEarnings: 0,
          totalPV: 0,
          joinDate: user.createdAt.toISOString(),
          lastActivity: user.lastActivityDate?.toISOString() || user.createdAt.toISOString(),
          status: user.active ? 'Active' : 'Inactive'
        }));

        break;

      case 'financial-summary':
        // Get financial summary report
        const financialData = await prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            memberId: true,
            firstName: true,
            surname: true,
            accountType: true,
            storeOwnerLevel: true,
            createdAt: true,
            lastActivityDate: true,
            active: true,
            _count: {
              select: {
                orders: true,
                ecashTransactions: true
              }
            }
          },
          orderBy,
          skip: offset,
          take: pageSize + 1,
        });

        totalCount = await prisma.user.count({ where: whereClause });

        data = financialData.slice(0, pageSize).map(user => ({
          id: user.id,
          memberId: user.memberId,
          fullName: `${user.firstName} ${user.surname}`,
          rank: user.storeOwnerLevel || user.accountType || 'Member',
          totalEarnings: 0,
          totalPV: 0,
          joinDate: user.createdAt.toISOString(),
          lastActivity: user.lastActivityDate?.toISOString() || user.createdAt.toISOString(),
          status: user.active ? 'Active' : 'Inactive'
        }));

        break;

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    const hasMore = data.length === pageSize && (offset + pageSize) < totalCount;

    return NextResponse.json({
      success: true,
      data,
      hasMore,
      totalCount,
      page,
      pageSize
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Virtualized reports error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\reports\virtualized\route.ts