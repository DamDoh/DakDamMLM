import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

/**
 * GET /api/referral/sponsor?identifier=xxx
 * Lookup and validate sponsor by member ID, email, or phone number
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for sponsor lookup API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier');
    const companyId = searchParams.get('companyId');

    if (!identifier) {
      return ApiResponseUtil.validationError([{
        field: 'identifier',
        message: 'Sponsor identifier (member ID, email, or phone) is required'
      }]);
    }

    // Search for sponsor by member ID, email, or phone number
    const where: any = {
      active: true,
      isAdmin: false, // Admins cannot be sponsors
      OR: [
        { memberId: identifier },
        { email: identifier.toLowerCase() },
        { phoneNumber: identifier }
      ]
    };

    if (companyId) {
      where.companyId = companyId;
    }

    const sponsor = await prisma.user.findFirst({
      where,
      select: {
        id: true,
        memberId: true,
        firstName: true,
        surname: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        rank: true,
        accountType: true,
        active: true,
        companyId: true
      }
    });

    if (!sponsor) {
      const duration = Date.now() - startTime;
      logger.info('Sponsor not found', {
        identifier,
        companyId,
        duration
      }, request);

      return NextResponse.json(
        { 
          success: false,
          error: 'Sponsor not found or not eligible',
          message: 'The sponsor ID you entered could not be found or is not eligible to sponsor new members.'
        },
        { status: 404 }
      );
    }

    // Additional validation - sponsor must be active
    if (!sponsor.active) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sponsor account is inactive',
          message: 'This sponsor account is currently inactive and cannot sponsor new members.'
        },
        { status: 400 }
      );
    }

    const duration = Date.now() - startTime;
    logger.info('Sponsor validated successfully', {
      identifier,
      sponsorId: sponsor.id,
      sponsorMemberId: sponsor.memberId,
      duration
    }, request);

    return ApiResponseUtil.success({
      id: sponsor.id,
      memberId: sponsor.memberId,
      fullName: sponsor.fullName,
      rank: sponsor.rank,
      accountType: sponsor.accountType,
      isEligible: true
    }, 'Sponsor found and validated');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Sponsor lookup error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}