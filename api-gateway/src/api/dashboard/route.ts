import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyToken } from '@/lib/auth';

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

    // Fetch dashboard data using Prisma
    const [userCommissions, userOrders, userData] = await Promise.all([
      prisma.commission.findMany({
        where: { userId: user.id }
      }),
      prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          teamSize: true,
          isAdmin: true
        }
      })
    ]);

    // Transform data for frontend
    const transformedCommissions = userCommissions.map(c => ({
      id: c.id,
      userId: c.userId,
      date: c.date.toISOString(),
      type: c.type,
      status: c.status as 'Paid' | 'Pending' | 'Failed',
      amount: c.amount
    }));

    const transformedOrders = userOrders.map(o => ({
      orderId: o.orderId,
      userId: o.userId,
      date: o.createdAt.toISOString(),
      amount: o.totalAmount,
      status: o.status as 'Fulfilled' | 'Pending' | 'Declined',
      itemCount: 0 // Will be calculated from order items if needed
    }));

    // Calculate metrics
    const totalEarned = userCommissions.reduce((acc, curr) => acc + curr.amount, 0);
    const ecashBalance = userCommissions
      .filter(c => c.status === 'Paid')
      .reduce((acc, curr) => acc + curr.amount, 0);

    // Get team members count (excluding self and admins)
    const allMembers = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: user.id } },
          { isAdmin: false }
        ]
      }
    });

    const totalMembers = allMembers.length;

    const dashboardData = {
      commissions: transformedCommissions,
      orders: transformedOrders,
      metrics: {
        totalEarned,
        ecashBalance,
        totalMembers,
        totalOrders: transformedOrders.length
      },
      user: userData
    };

    return NextResponse.json({ success: true, data: dashboardData, message: 'Dashboard data retrieved successfully' });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}