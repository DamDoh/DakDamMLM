import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for commissions API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request and execute handler with authenticated user
    return requireAuth(async (req) => {
      const user = req.user;
      if (!user) {
        return ApiResponseUtil.unauthorized();
      }

      const searchParams = request.nextUrl.searchParams;
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const offset = parseInt(searchParams.get('offset') || '0');
      const status = searchParams.get('status');

      // Build where clause - users can only see their own commissions unless admin
      const where: any = {};
      
      // Admins can query other users' commissions or see all commissions
      const queriedUserId = searchParams.get('userId');
      if (user.isAdmin) {
        // If admin specifies a userId, filter by that user
        // If no userId specified, show ALL commissions (for Run Commissions page)
        if (queriedUserId) {
          where.userId = queriedUserId;
        }
        // else: no userId filter = show all commissions
      } else {
        // Non-admin users can only see their own commissions
        where.userId = user.id;
      }
      
      if (status) {
        where.status = status;
      }

      // Fetch all commissions for the user
      const allCommissions = await prisma.commission.findMany({
        where,
        orderBy: { date: 'desc' }
      });

      // Filter commissions:
      // 1. Only show specific commission types: Binary Bonus, Matching Bonus, Stockist Bonus
      // 2. CRITICAL: For Stockist Bonus, ONLY show commissions from actual stock transfers
      //    - Accept: "Stockist Bonus (S)", "Stockist Bonus (M)", etc. (with level indicator)
      //    - Reject: Generic "Stockist Bonus" (old auto-created commissions without level indicator)
      const allowedCommissionTypes = [
        'Binary Bonus',
        'Matching Bonus',
        'Daily Match',
      ];

      const filteredCommissions = allCommissions.filter(c => {
        // Reject generic "Stockist Bonus" without level indicator - these are old auto-created commissions
        if (c.type === 'Stockist Bonus') {
          return false; // Exclude old auto-created Stockist Bonus
        }
        
        // Accept "Stockist Bonus (S)", "Stockist Bonus (M)", etc. (from actual stock transfers)
        if (c.type && c.type.includes('Stockist Bonus')) {
          // Only accept if it has level indicator: "Stockist Bonus (S)", "Stockist Bonus (M)", etc.
          return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
        }
        
        // Accept other allowed commission types
        return allowedCommissionTypes.includes(c.type) || 
               (c.type && c.type.startsWith('Matching Bonus'));
      });

      // Apply pagination after filtering
      const total = filteredCommissions.length;
      const limitedCommissions = filteredCommissions.slice(offset, offset + limit);

      // Get unique user IDs to fetch memberIds
      const uniqueUserIds = [...new Set(limitedCommissions.map(c => c.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, memberId: true }
      });
      const userMap = new Map(users.map(u => [u.id, u.memberId]));

      // Transform Prisma data to match expected types
      const transformedCommissions = limitedCommissions.map(c => ({
        id: c.id,
        userId: c.userId,
        memberId: userMap.get(c.userId) || null,
        date: c.date.toISOString(),
        type: c.type,
        status: c.status as 'Paid' | 'Pending' | 'Failed',
        amount: c.amount
      }));

      const duration = Date.now() - startTime;
      logger.info('Commissions fetched', {
        userId: user.id,
        count: transformedCommissions.length,
        duration
      }, request);

      return ApiResponseUtil.paginated(
        transformedCommissions,
        total,
        limit,
        offset,
        API_MESSAGES.FETCHED
      );
    })(request);

  } catch (error) {
    logger.error('Failed to fetch commissions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}