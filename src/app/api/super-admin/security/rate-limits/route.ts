import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/security/rate-limits
 * List all rate limiting rules
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const rules = await prisma.rateLimitRule.findMany({
        orderBy: { endpoint: 'asc' }
      });

      return NextResponse.json({ rules });
    } catch (error) {
      console.error('Get rate limit rules error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve rate limit rules' },
        { status: 500 }
      );
    }
  })(request);
}

/**
 * POST /api/super-admin/security/rate-limits
 * Create or update rate limiting rule
 */
export async function POST(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const body = await request.json();
      const { endpoint, method, limit, window, scope, conditions } = body;

      if (!endpoint || !limit || !window) {
        return NextResponse.json(
          { error: 'Missing required fields: endpoint, limit, window' },
          { status: 400 }
        );
      }

      const rule = await prisma.rateLimitRule.create({
        data: {
          endpoint,
          method: method || 'ALL',
          limit,
          window,
          scope: scope || 'global',
          conditions: conditions || {},
          isActive: true
        }
      });

      return NextResponse.json({
        success: true,
        rule
      });
    } catch (error) {
      console.error('Create rate limit rule error:', error);
      return NextResponse.json(
        { error: 'Failed to create rate limit rule' },
        { status: 500 }
      );
    }
  })(request);
}
