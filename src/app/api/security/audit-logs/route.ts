import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin/super admin
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
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const search = searchParams.get('search') || '';
    const action = searchParams.get('action') || '';
    const entity = searchParams.get('entity') || '';
    const userId = searchParams.get('userId') || '';
    const dateRange = searchParams.get('dateRange') || '24h';

    const offset = page * pageSize;

    // Calculate date filter
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Build where clause
    const whereClause: any = {
      createdAt: {
        gte: startDate
      }
    };

    // Add company filter for non-super admins
    if (user.companyId && user.accountType !== 'SuperAdmin') {
      whereClause.companyId = user.companyId;
    }

    // Add search filters
    if (search) {
      whereClause.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } },
        { user: {
          OR: [
            { memberId: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { surname: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ];
    }

    if (action) {
      whereClause.action = { contains: action, mode: 'insensitive' };
    }

    if (entity) {
      whereClause.entity = { contains: entity, mode: 'insensitive' };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    // Get total count
    const totalCount = await prisma.auditLog.count({ where: whereClause });

    // Get logs with user information
    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            memberId: true,
            firstName: true,
            surname: true,
            accountType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: pageSize
    });

    const hasMore = offset + pageSize < totalCount;

    return NextResponse.json({
      success: true,
      logs,
      hasMore,
      totalCount,
      page,
      pageSize
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Security audit logs error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export endpoint for CSV download
export async function PUT(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin/super admin
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
    const format = searchParams.get('format') || 'csv';
    const search = searchParams.get('search') || '';
    const action = searchParams.get('action') || '';
    const entity = searchParams.get('entity') || '';
    const userId = searchParams.get('userId') || '';
    const dateRange = searchParams.get('dateRange') || '24h';

    // Calculate date filter
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Build where clause (same as GET)
    const whereClause: any = {
      createdAt: {
        gte: startDate
      }
    };

    if (user.companyId && user.accountType !== 'SuperAdmin') {
      whereClause.companyId = user.companyId;
    }

    if (search) {
      whereClause.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } },
        { user: {
          OR: [
            { memberId: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { surname: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ];
    }

    if (action) {
      whereClause.action = { contains: action, mode: 'insensitive' };
    }

    if (entity) {
      whereClause.entity = { contains: entity, mode: 'insensitive' };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    // Get all matching logs for export
    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            memberId: true,
            firstName: true,
            surname: true,
            accountType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10000 // Limit export to 10k records for performance
    });

    // Generate CSV
    const csvHeaders = [
      'Timestamp',
      'User ID',
      'Member ID',
      'User Name',
      'Account Type',
      'Action',
      'Entity',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Company ID',
      'Changes'
    ];

    const csvRows = logs.map(log => [
      log.createdAt.toISOString(),
      log.userId || '',
      log.user?.memberId || '',
      log.user ? `${log.user.firstName} ${log.user.surname}` : '',
      log.user?.accountType || '',
      log.action,
      log.entity,
      log.entityId || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.companyId || '',
      log.changes ? JSON.stringify(log.changes) : ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Security audit logs export error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\security\audit-logs\route.ts