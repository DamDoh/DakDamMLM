import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth-middleware';

export const GET = requireSuperAdmin(async function(request: NextRequest) {
  try {
    // Get actual total companies from database
    const totalCompanies = await prisma.company.count();

    // Get active companies (isActive = true AND isVerified = true)
    const activeCompanies = await prisma.company.count({
      where: {
        isActive: true,
        isVerified: true
      }
    });

    // Get total users across all companies (only active users)
    const totalUsers = await prisma.user.count({
      where: { 
        deleted: false,
        active: true
      }
    });

    // Calculate actual revenue from completed orders (exclude pending and cancelled)
    const revenueResult = await prisma.order.aggregate({
      where: {
        status: {
          notIn: ['Pending', 'Cancelled', 'Declined']
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    // Also get monthly revenue for this month
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const monthlyRevenueResult = await prisma.order.aggregate({
      where: {
        status: {
          notIn: ['Pending', 'Cancelled', 'Declined']
        },
        createdAt: {
          gte: thisMonthStart
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    const totalRevenue = revenueResult._sum.totalAmount || 0;
    const monthlyRevenue = monthlyRevenueResult._sum.totalAmount || 0;

    // Calculate monthly growth based on last month's data
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const currentMonthUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: oneMonthAgo
        },
        active: true,
        deleted: false
      }
    });

    const previousMonthUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(oneMonthAgo.getFullYear(), oneMonthAgo.getMonth() - 1, 1),
          lt: oneMonthAgo
        },
        active: true,
        deleted: false
      }
    });

    const monthlyGrowth = previousMonthUsers > 0 
      ? ((currentMonthUsers - previousMonthUsers) / previousMonthUsers) * 100 
      : currentMonthUsers > 0 ? 100 : 0;

    // System health score (based on active vs total companies ratio)
    const systemHealth = totalCompanies > 0 
      ? Math.round((activeCompanies / totalCompanies) * 100)
      : 100;

    const stats = {
      totalCompanies,
      activeCompanies,
      totalUsers,
      totalRevenue,
      monthlyRevenue, // Monthly revenue for current month
      monthlyGrowth: Math.round(monthlyGrowth * 10) / 10, // Round to 1 decimal place
      systemHealth
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Super admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system statistics' },
      { status: 500 }
    );
  }
});