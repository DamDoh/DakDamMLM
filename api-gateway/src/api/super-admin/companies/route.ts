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
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 50 });
      if (!rateLimitResult.success) {
        logger.warn('Rate limit exceeded for super admin companies API', {
          ip: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent')
        }, request);
        return rateLimitResult.response!;
      }

      // Get all users and group them by a simulated company structure
      const users = await prisma.user.findMany({
        where: { active: true },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Create mock company data based on user distribution
      const companyMap = new Map();

      // Simulate different companies based on user creation dates
      const mockCompanies = [
        { id: 'company-001', name: 'ABC Nutrition', status: 'active' },
        { id: 'company-002', name: 'XYZ Health Corp', status: 'active' },
        { id: 'company-003', name: 'Global Wellness Ltd', status: 'pending' },
        { id: 'company-004', name: 'VitalLife Solutions', status: 'suspended' },
      ];

      mockCompanies.forEach((company, index) => {
        const userCount = Math.floor(users.length / mockCompanies.length) + (index === 0 ? users.length % mockCompanies.length : 0);
        companyMap.set(company.id, {
          id: company.id,
          name: company.name,
          status: company.status,
          userCount,
          createdAt: users[0]?.createdAt || new Date(),
          lastActivity: users[users.length - 1]?.updatedAt || new Date(),
          logoUrl: null
        });
      });

      // Convert to array and add mock data
      const companyOverview = Array.from(companyMap.values()).map(company => ({
        id: company.id,
        name: company.name,
        status: company.status,
        userCount: company.userCount,
        revenue: company.userCount * 50, // Mock revenue calculation
        createdAt: company.createdAt.toISOString(),
        lastActivity: company.lastActivity.toISOString(),
        subscriptionTier: 'Professional',
        logoUrl: company.logoUrl
      }));

      const duration = Date.now() - startTime;
      logger.info('Super admin companies data accessed', {
        companyCount: companyOverview.length,
        totalUsers: users.length,
        duration
      }, request);

      return NextResponse.json({
        success: true,
        data: companyOverview,
        summary: {
          totalCompanies: companyOverview.length,
          totalUsers: users.length,
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