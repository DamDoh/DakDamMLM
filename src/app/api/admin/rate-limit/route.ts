import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { clearAllRateLimits, clearRateLimitByIP, clearRateLimitsByPattern, getRateLimitStats } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/rate-limit
 * Get rate limit statistics (Admin only)
 */
export async function GET(request: NextRequest) {
  return requireAdmin(async (req) => {
    try {
      const stats = getRateLimitStats();
      return NextResponse.json({
        success: true,
        stats
      });
    } catch (error: any) {
      logger.error('Failed to get rate limit stats', { error: error.message }, req);
      return NextResponse.json(
        { success: false, error: 'Failed to get rate limit statistics' },
        { status: 500 }
      );
    }
  })(request);
}

/**
 * DELETE /api/admin/rate-limit
 * Clear rate limits (Admin only)
 * Query params:
 * - ip: Clear rate limit for specific IP
 * - pattern: Clear rate limits matching pattern
 * - all: Clear all rate limits (if true)
 */
export async function DELETE(request: NextRequest) {
  return requireAdmin(async (req) => {
    try {
      const { searchParams } = new URL(request.url);
      const ip = searchParams.get('ip');
      const pattern = searchParams.get('pattern');
      const all = searchParams.get('all') === 'true';

      if (all) {
        clearAllRateLimits();
        logger.warn('All rate limits cleared by admin', { adminId: req.user?.id }, req);
        return NextResponse.json({
          success: true,
          message: 'All rate limits cleared'
        });
      } else if (ip) {
        clearRateLimitByIP(ip);
        logger.info('Rate limit cleared for IP by admin', { ip, adminId: req.user?.id }, req);
        return NextResponse.json({
          success: true,
          message: `Rate limit cleared for IP: ${ip}`
        });
      } else if (pattern) {
        clearRateLimitsByPattern(pattern);
        logger.info('Rate limits cleared by pattern by admin', { pattern, adminId: req.user?.id }, req);
        return NextResponse.json({
          success: true,
          message: `Rate limits cleared matching pattern: ${pattern}`
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Please provide ip, pattern, or all=true parameter' },
          { status: 400 }
        );
      }
    } catch (error: any) {
      logger.error('Failed to clear rate limits', { error: error.message }, req);
      return NextResponse.json(
        { success: false, error: 'Failed to clear rate limits' },
        { status: 500 }
      );
    }
  })(request);
}
