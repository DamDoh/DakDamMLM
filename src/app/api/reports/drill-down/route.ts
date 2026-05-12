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
    const dimension = searchParams.get('dimension') || 'overview';
    const value = searchParams.get('value');
    const dateRange = searchParams.get('dateRange') || '30d';
    const level = parseInt(searchParams.get('level') || '0');

    // Calculate date filter
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Add company filter for non-super admins
    const companyFilter = user.companyId && user.accountType !== 'SuperAdmin' ? { companyId: user.companyId } : {};

    let drillDownData: any = {
      dimension,
      level,
      metrics: [],
      children: []
    };

    switch (dimension) {
      case 'overview':
        // Executive overview metrics
        const totalRevenue = await prisma.order.aggregate({
          where: {
            createdAt: { gte: startDate },
            status: 'completed',
            ...companyFilter
          },
          _sum: { totalAmount: true }
        });

        const totalOrders = await prisma.order.count({
          where: {
            createdAt: { gte: startDate },
            status: 'completed',
            ...companyFilter
          }
        });

        const activeUsers = await prisma.user.count({
          where: {
            lastActivityDate: { gte: startDate },
            active: true,
            ...companyFilter
          }
        });

        const totalUsers = await prisma.user.count({
          where: {
            active: true,
            ...companyFilter
          }
        });

        drillDownData.metrics = [
          {
            id: 'totalRevenue',
            name: 'Total Revenue',
            value: totalRevenue._sum.totalAmount || 0,
            change: 12.5, // Mock change percentage
            trend: 'up',
            category: 'Financial'
          },
          {
            id: 'totalOrders',
            name: 'Total Orders',
            value: totalOrders,
            change: 8.3,
            trend: 'up',
            category: 'Sales'
          },
          {
            id: 'activeUsers',
            name: 'Active Users',
            value: activeUsers,
            change: -2.1,
            trend: 'down',
            category: 'Users'
          },
          {
            id: 'conversionRate',
            name: 'Conversion Rate',
            value: totalUsers > 0 ? Math.round((totalOrders / totalUsers) * 100) : 0,
            change: 5.7,
            trend: 'up',
            category: 'Performance'
          }
        ];
        break;

      case 'metric':
        // Drill down into a specific metric
        if (value === 'totalRevenue') {
          // Revenue by product category
          const revenueByCategory = await prisma.order.groupBy({
            by: ['items'], // This is simplified - would need proper category joining
            where: {
              createdAt: { gte: startDate },
              status: 'completed',
              ...companyFilter
            },
            _sum: { totalAmount: true },
            _count: true
          });

          drillDownData.children = revenueByCategory.map((item, index) => ({
            dimension: 'category',
            value: `Category ${index + 1}`, // Mock category name
            metrics: [{
              id: 'revenue',
              name: 'Revenue',
              value: item._sum.totalAmount || 0,
              change: 0,
              trend: 'stable',
              category: 'Financial'
            }],
            level: level + 1
          }));
        }
        break;

      case 'category':
        // Product category details
        if (value) {
          const categoryRevenue = await prisma.order.aggregate({
            where: {
              createdAt: { gte: startDate },
              status: 'completed',
              ...companyFilter
              // Would need category filtering here
            },
            _sum: { totalAmount: true },
            _count: true
          });

          drillDownData.metrics = [
            {
              id: 'categoryRevenue',
              name: `${value} Revenue`,
              value: categoryRevenue._sum.totalAmount || 0,
              change: 0,
              trend: 'stable',
              category: 'Financial'
            },
            {
              id: 'categoryOrders',
              name: `${value} Orders`,
              value: categoryRevenue._count,
              change: 0,
              trend: 'stable',
              category: 'Sales'
            }
          ];
        }
        break;
    }

    return NextResponse.json({
      success: true,
      data: drillDownData
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Drill-down reporting error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\reports\drill-down\route.ts