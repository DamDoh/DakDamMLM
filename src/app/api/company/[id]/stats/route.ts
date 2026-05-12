import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Get company stats
    const [
      userCount,
      productCount,
      orderCount,
      revenueResult,
      activeUsersThisMonth,
      pendingVerifications
    ] = await Promise.all([
      // Total users
      prisma.user.count({
        where: { companyId: id }
      }),

      // Total products
      prisma.product.count({
        where: { companyId: id }
      }),

      // Total orders
      prisma.order.count({
        where: { companyId: id }
      }),

      // Total revenue
      prisma.order.aggregate({
        where: {
          companyId: id,
          status: 'Fulfilled'
        },
        _sum: {
          totalAmount: true
        }
      }),

      // Active users this month (simplified - using createdAt as proxy)
      prisma.user.count({
        where: {
          companyId: id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Pending verifications (users without verified email/phone - simplified)
      prisma.user.count({
        where: {
          companyId: id,
          active: true
        }
      })
    ]);

    // Calculate monthly growth (simplified - would need historical data)
    const monthlyGrowth = 12.5; // Placeholder

    // System health score (simplified)
    const systemHealth = 98; // Placeholder

    const stats = {
      totalUsers: userCount,
      activeUsers: activeUsersThisMonth,
      totalProducts: productCount,
      totalOrders: orderCount,
      totalRevenue: revenueResult._sum.totalAmount || 0,
      monthlyGrowth,
      pendingVerifications,
      systemHealth
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Company stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company statistics' },
      { status: 500 }
    );
  }
}