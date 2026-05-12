import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const startTime = Date.now();
  const { companyId } = await params;

  return requireSuperAdmin(async (authenticatedRequest) => {
    try {
      // Apply rate limiting
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
      if (!rateLimitResult.success) {
        logger.warn('Rate limit exceeded for super admin company details API', {
          ip: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent'),
          companyId
        }, request);
        return rateLimitResult.response!;
      }

      // Fetch company from database
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          _count: {
            select: { users: true }
          }
        }
      });

      if (!company) {
        logger.warn('Company not found', { companyId }, request);
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      // Fetch users for this company
      const users = await prisma.user.findMany({
        where: {
          active: true,
          companyId: companyId
        },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          email: true,
          rank: true,
          pv: true,
          createdAt: true,
        },
        take: 50, // Limit to 50 users for performance
        orderBy: { createdAt: 'desc' }
      });

      // Determine status
      const status = !company.isActive ? 'suspended' 
        : !company.isVerified ? 'pending' 
        : 'active';

      // Map users to the format expected by the modal
      const mappedUsers = users.map((user) => ({
        id: user.id,
        memberId: user.memberId || 'N/A',
        fullName: user.fullName || 'Unknown User',
        email: user.email || 'N/A',
        rank: user.rank || 'Distributor',
        pv: user.pv || 0,
        joinDate: user.createdAt.toISOString(),
      }));

      // Calculate revenue based on user count (mock calculation)
      const userCount = mappedUsers.length;
      const revenue = userCount * 50;

      const companyDetails = {
        id: company.id,
        name: company.name,
        description: company.description || '',
        email: company.email || '',
        phone: company.phone || '',
        website: company.website || '',
        country: company.country || '',
        currency: company.currency || 'USD',
        timezone: company.timezone || 'UTC',
        taxId: company.taxId || '',
        licenseNumber: company.licenseNumber || '',
        industry: company.industry || '',
        logoUrl: company.logoUrl,
        status: status,
        subscriptionTier: 'Professional', // Default subscription tier
        createdAt: company.createdAt.toISOString(),
        lastActivity: company.updatedAt.toISOString(),
        userCount,
        revenue,
        users: mappedUsers,
        isVerified: company.isVerified,
        isActive: company.isActive,
        allowEmailLogin: company.allowEmailLogin,
        allowPhoneLogin: company.allowPhoneLogin,
        requireEmailVerification: company.requireEmailVerification,
        requirePhoneVerification: company.requirePhoneVerification,
      };

      const duration = Date.now() - startTime;
      logger.info('Super admin company details accessed', {
        companyId,
        companyName: company.name,
        userCount,
        duration
      }, request);

      return NextResponse.json(companyDetails);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Super admin company details error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        companyId,
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
        { error: 'Failed to fetch company details' },
        { status: 500 }
      );
    }
  })(request);
}

