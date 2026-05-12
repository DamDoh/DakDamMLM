import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/rule-versions
 * Get rule versions (optionally filtered by ruleId)
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const { searchParams } = new URL(request.url);
      const ruleId = searchParams.get('ruleId');

      const where: any = {};
      if (ruleId) {
        where.ruleId = ruleId;
      }

      const versions = await prisma.ruleVersion.findMany({
        where,
        orderBy: {
          version: 'desc'
        }
      });

      // Transform the data
      const transformedVersions = versions.map(version => ({
        id: version.id,
        ruleId: version.ruleId,
        version: version.version,
        data: version.data,
        changes: version.changes,
        createdAt: version.createdAt.toISOString(),
        createdBy: version.createdBy,
        companyId: version.companyId || undefined
      }));

      return NextResponse.json({
        success: true,
        data: transformedVersions
      });
    })(request);
  } catch (error) {
    console.error('Error fetching rule versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule versions' },
      { status: 500 }
    );
  }
}

