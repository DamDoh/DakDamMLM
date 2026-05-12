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

    // Get user data for dashboard (including eCashBalance)
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        teamSize: true,
        isAdmin: true,
        storeOwnerLevel: true,
        pv: true,
        rank: true,
        eCashBalance: true
      } as any
    });

    // Fetch dashboard data using Prisma
    // All account types (Customer, Distributor, Stockist) now see orders in dashboard
    const [userCommissions, userOrders] = await Promise.all([
      prisma.commission.findMany({
        where: { userId: user.id }
      }),
      prisma.order.findMany({
        where: { userId: user.id },
        include: {
          items: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limit to recent 10 orders for dashboard
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
      amount: o.totalAmount || o.amount || 0,
      status: o.status as 'Fulfilled' | 'Pending' | 'Declined',
      itemCount: Array.isArray(o.items) ? o.items.length : (o.itemCount || 0)
    }));

    // Calculate Total Commission Earned - match Commission page calculation
    // Only include commission types shown on Commission page: Binary Bonus, Matching Bonus, Daily Match, Rank Bonus, Stockist Bonus (with level)
    const allowedCommissionTypesForTotal = [
      'Binary Bonus',
      'Matching Bonus',
      'Daily Match',
      'Rank Bonus',
    ];

    const validCommissionsForTotal = userCommissions.filter(c => {
      // Reject generic "Stockist Bonus" without level indicator (old auto-created commissions)
      if (c.type === 'Stockist Bonus') {
        return false; // Exclude old auto-created Stockist Bonus
      }
      // Accept "Stockist Bonus (S)", "Stockist Bonus (M)", etc. (from actual stock transfers)
      if (c.type && c.type.includes('Stockist Bonus')) {
        // Only accept if it has level indicator
        return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
      }
      // Accept other allowed commission types (same as Commission page)
      return allowedCommissionTypesForTotal.includes(c.type) || 
             (c.type && (c.type.startsWith('Matching Bonus') || c.type.startsWith('Rank Bonus')));
    });
    
    // Total Commission Earned - matches Commission page (only includes allowed types)
    const totalEarned = validCommissionsForTotal.reduce((acc, curr) => acc + curr.amount, 0);
    
    // E-Cash Balance - use database eCashBalance field (source of truth)
    // This matches the /api/e-cash endpoint which uses databaseBalance
    // The eCashBalance field is updated when:
    // - Commissions are paid (updates eCashBalance)
    // - Transfers from E-Comm occur (updates eCashBalance)
    // - Admin transfers E-Cash to members (updates eCashBalance)
    // - Withdrawals are processed (updates eCashBalance)
    // - Manual adjustments are made (updates eCashBalance)
    const ecashBalance = Number(userData?.eCashBalance || 0);

    // Get team members count - count all downline members recursively
    // This counts all members in the binary tree under this user
    const countDownlineMembers = async (userId: string, visited = new Set<string>()): Promise<number> => {
      // Prevent circular references
      if (visited.has(userId)) {
        return 0;
      }
      visited.add(userId);
      
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { children: true }
      });
      
      if (!userRecord || !userRecord.children) {
        // If no binary tree children, count direct sponsored members
        return await prisma.user.count({
          where: {
            sponsorId: userId,
            isAdmin: false,
            active: true,
            deleted: false
          }
        });
      }
      
      const children = userRecord.children as any;
      let count = 0;
      
      // Recursively count left leg (child + all their descendants)
      if (children.left && !visited.has(children.left)) {
        count += 1 + await countDownlineMembers(children.left, visited);
      }
      
      // Recursively count right leg (child + all their descendants)
      if (children.right && !visited.has(children.right)) {
        count += 1 + await countDownlineMembers(children.right, visited);
      }
      
      // Also count sponsored members who are not in binary tree positions yet
      // (e.g., members who are sponsored but not placed in left/right yet)
      const directSponsored = await prisma.user.count({
        where: {
          sponsorId: userId,
          isAdmin: false,
          active: true,
          deleted: false,
          id: {
            notIn: [children.left, children.right].filter(Boolean)
          }
        }
      });
      count += directSponsored;
      
      return count;
    };

    let totalMembers = 0;
    try {
      totalMembers = await countDownlineMembers(user.id);
    } catch (error) {
      console.error('Error counting team members, using fallback:', error);
      // Fallback: count direct sponsored members
      totalMembers = await prisma.user.count({
        where: {
          sponsorId: user.id,
          isAdmin: false,
          active: true,
          deleted: false
        }
      });
    }

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