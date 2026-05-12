import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  return requireSuperAdmin(async (authenticatedRequest) => {
    try {
      // Apply rate limiting for super admin operations
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
      if (!rateLimitResult.success) {
        logger.warn('Rate limit exceeded for super admin companies API', {
          ip: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent')
        }, request);
        return rateLimitResult.response!;
      }

      // Get all companies from database
      const companies = await prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true }
          }
        }
      });

      // Get user counts per company
      const userCounts = await prisma.user.groupBy({
        by: ['companyId'],
        where: {
          active: true,
          companyId: { not: null }
        },
        _count: {
          id: true
        }
      });

      const userCountMap = new Map(
        userCounts.map(uc => [uc.companyId, uc._count.id])
      );

      // Convert to company overview format
      const companyOverview = companies.map(company => {
        const status = !company.isActive ? 'suspended' 
          : !company.isVerified ? 'pending' 
          : 'active';
        
        return {
          id: company.id,
          name: company.name,
          status: status,
          userCount: userCountMap.get(company.id) || 0,
          revenue: (userCountMap.get(company.id) || 0) * 50, // Mock revenue calculation
          createdAt: company.createdAt.toISOString(),
          lastActivity: company.updatedAt.toISOString(),
          subscriptionTier: 'Professional',
          logoUrl: company.logoUrl,
          email: company.email,
          phone: company.phone,
          country: company.country,
          isVerified: company.isVerified,
          isActive: company.isActive
        };
      });

      // Calculate total users across all companies
      const totalUsers = Array.from(userCountMap.values()).reduce((sum, count) => sum + count, 0);

      const duration = Date.now() - startTime;
      logger.info('Super admin companies data accessed', {
        companyCount: companyOverview.length,
        totalUsers: totalUsers,
        duration
      }, request);

      return NextResponse.json({
        success: true,
        data: companyOverview,
        summary: {
          totalCompanies: companyOverview.length,
          totalUsers: totalUsers,
          activeCompanies: companyOverview.filter(c => c.status === 'active').length
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Super admin companies error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        ip: request.headers.get('x-forwarded-for')
      }, request);

      if (error instanceof Error && error.message.includes('Authentication')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch companies' },
        { status: 500 }
      );
    }
  })(request);
}