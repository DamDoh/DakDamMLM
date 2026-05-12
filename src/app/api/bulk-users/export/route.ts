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
    const format = searchParams.get('format') || 'csv';
    const userType = searchParams.get('userType') || '';
    const status = searchParams.get('status') || '';
    const dateRange = searchParams.get('dateRange') || 'all';

    // Build where clause
    const whereClause: any = {};

    // Add company filter for non-super admins
    if (user.companyId && user.accountType !== 'SuperAdmin') {
      whereClause.companyId = user.companyId;
    }

    // Add filters
    if (userType) {
      whereClause.accountType = userType;
    }

    if (status) {
      whereClause.active = status === 'active';
      if (status === 'suspended') {
        whereClause.lockedUntil = { not: null };
      }
    }

    // Add date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case '1m':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '6m':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // Beginning of time
      }

      whereClause.createdAt = { gte: startDate };
    }

    // Get users for export
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        memberId: true,
        email: true,
        firstName: true,
        surname: true,
        phoneNumber: true,
        accountType: true,
        storeOwnerLevel: true,
        active: true,
        createdAt: true,
        lastActivityDate: true,
        sponsorId: true,
        referralCode: true,
        companyId: true,
        lockedUntil: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50000 // Limit to prevent excessive exports
    });

    // Format data based on requested format
    if (format === 'json') {
      return NextResponse.json(users, {
        headers: {
          'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    // Generate CSV
    const csvHeaders = [
      'Member ID',
      'Email',
      'First Name',
      'Surname',
      'Phone Number',
      'Account Type',
      'Store Owner Level',
      'Status',
      'Created Date',
      'Last Activity',
      'Sponsor ID',
      'Referral Code',
      'Company ID'
    ];

    const csvRows = users.map(user => [
      user.memberId,
      user.email,
      user.firstName,
      user.surname,
      user.phoneNumber || '',
      user.accountType || '',
      user.storeOwnerLevel || '',
      user.active ? 'Active' : (user.lockedUntil ? 'Suspended' : 'Inactive'),
      user.createdAt.toISOString().split('T')[0],
      user.lastActivityDate?.toISOString().split('T')[0] || '',
      user.sponsorId || '',
      user.referralCode || '',
      user.companyId || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'bulk_export',
        entity: 'bulk_operation',
        entityId: `bulk_export_${Date.now()}`,
        changes: {
          format,
          filters: { userType, status, dateRange },
          recordCount: users.length
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent') || '',
        companyId: user.companyId
      }
    });

    logger.info('Bulk user export completed', {
      exportedBy: user.id,
      format,
      recordCount: users.length,
      filters: { userType, status, dateRange }
    });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Bulk user export error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\bulk-users\export\route.ts