import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { generateSimpleOTPServer } from '@/services/simple-otp-service';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - OTP generation is sensitive
    const rateLimitResult = await rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5 // 5 OTP requests per minute
    });
    if (!rateLimitResult.success) {
      logger.warn('OTP generation rate limit exceeded', {
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
      // Authentication is optional for OTP generation
      logger.info('OTP generation without authentication', {
        ip: request.headers.get('x-forwarded-for')
      });
    }

    const body = await request.json();
    const { identifier, type, purpose, companyId } = body;

    // Validate required fields
    if (!identifier || !type || !purpose) {
      return ApiResponseUtil.validationError([
        { field: 'identifier', message: 'Identifier (email/phone) is required' },
        { field: 'type', message: 'Type (email/sms) is required' },
        { field: 'purpose', message: 'Purpose is required' }
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

    // Get client information for security tracking
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Generate OTP
    const result = await generateSimpleOTPServer({
      identifier,
      type,
      purpose,
      companyId: companyId || (user?.companyId) || undefined,
    });

    if (!result.success) {
      logger.warn('OTP generation failed', {
        identifier: identifier.substring(0, 3) + '***', // Partial logging for privacy
        type,
        purpose,
        error: result.error,
        ip: ipAddress
      }, request);

      return ApiResponseUtil.error(result.error || 'Failed to generate OTP');
    }

    logger.info('OTP generated successfully', {
      type,
      purpose,
      otpId: result.otpId,
      identifier: identifier.substring(0, 3) + '***', // Partial logging for privacy
      userId: user?.id,
      ip: ipAddress,
      duration: Date.now() - startTime
    }, request);

    // Return success response (don't include the actual OTP code)
    return ApiResponseUtil.success({
      otpId: result.otpId,
      type,
      purpose,
      message: result.message || `OTP sent to ${type === 'email' ? 'email' : 'phone number'}. Please check your ${type}.`
    }, 'OTP generated successfully');

  } catch (error) {
    logger.error('OTP generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}