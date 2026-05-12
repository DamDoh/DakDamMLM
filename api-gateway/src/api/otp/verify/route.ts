import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { verifySimpleOTPServer } from '@/services/simple-otp-service';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - OTP verification is sensitive
    const rateLimitResult = await rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10 // 10 verification attempts per minute
    });
    if (!rateLimitResult.success) {
      logger.warn('OTP verification rate limit exceeded', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Optional authentication - some OTP flows might not require auth
    let user = null;
    try {
      const authenticatedRequest = await requireAuth(async (req) => {
        return NextResponse.json({ user: req.user });
      })(request);
      user = (authenticatedRequest as any).user;
    } catch (authError) {
      // Authentication is optional for OTP verification
      logger.info('OTP verification without authentication', {
        ip: request.headers.get('x-forwarded-for')
      });
    }

    const body = await request.json();
    const { identifier, type, purpose, code, companyId } = body;

    // Validate required fields
    if (!identifier || !type || !purpose || !code) {
      return ApiResponseUtil.validationError([
        { field: 'identifier', message: 'Identifier (email/phone) is required' },
        { field: 'type', message: 'Type (email/sms) is required' },
        { field: 'purpose', message: 'Purpose is required' },
        { field: 'code', message: 'OTP code is required' }
      ]);
    }

    // Validate type
    if (!['email', 'sms'].includes(type)) {
      return ApiResponseUtil.validationError([{
        field: 'type',
        message: 'Type must be either "email" or "sms"'
      }]);
    }

    // Validate purpose
    const validPurposes = ['verification', 'password_reset', 'login_2fa', 'transaction'];
    if (!validPurposes.includes(purpose)) {
      return ApiResponseUtil.validationError([{
        field: 'purpose',
        message: `Purpose must be one of: ${validPurposes.join(', ')}`
      }]);
    }

    // Validate OTP code format (should be numeric)
    if (!/^\d{6}$/.test(code)) {
      return ApiResponseUtil.validationError([{
        field: 'code',
        message: 'OTP code must be a 6-digit number'
      }]);
    }

    // Get client information for security tracking
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify OTP
    const result = await verifySimpleOTPServer({
      identifier,
      code,
      purpose,
      companyId: companyId || (user?.companyId) || undefined,
    });

    if (!result.success) {
      logger.warn('OTP verification failed', {
        identifier: identifier.substring(0, 3) + '***', // Partial logging for privacy
        type,
        purpose,
        otpId: result.otpId,
        error: result.error,
        ip: ipAddress
      }, request);

      const errorMessage = result.error || 'Invalid OTP code';

      return ApiResponseUtil.error(errorMessage);
    }

    logger.info('OTP verified successfully', {
      type,
      purpose,
      otpId: result.otpId,
      identifier: identifier.substring(0, 3) + '***', // Partial logging for privacy
      userId: user?.id,
      ip: ipAddress,
      duration: Date.now() - startTime
    }, request);

    // Return success response
    return ApiResponseUtil.success({
      otpId: result.otpId,
      type,
      purpose,
      message: result.message || 'OTP verified successfully'
    }, 'OTP verified successfully');

  } catch (error) {
    logger.error('OTP verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}