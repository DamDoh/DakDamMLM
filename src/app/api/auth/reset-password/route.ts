import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/services/password-reset-service';
import { rateLimit, createAuthRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { InputSanitizer, validateRequestSafety } from '@/lib/input-sanitization';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate request safety first
    const safetyCheck = validateRequestSafety(request);
    if (!safetyCheck.safe) {
      logger.security('Unsafe password reset attempt blocked', undefined, {
        reason: safetyCheck.reason,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return NextResponse.json(
        { error: 'Request blocked for security reasons' },
        { status: 403 }
      );
    }

    // Apply rate limiting for password reset attempts
    const rateLimitResult = await rateLimit(request, createAuthRateLimit());
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for password reset attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const bodyText = await request.text();
    const body = InputSanitizer.sanitizeJSON(bodyText);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Sanitize all string inputs
    const sanitizedBody = InputSanitizer.sanitizeObject(body as Record<string, any>, {
      allowHTML: false,
      maxLength: 1000
    });

    const { token, newPassword, confirmPassword } = sanitizedBody;

    // Validate required fields
    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Token, new password, and confirmation are required' },
        { status: 400 }
      );
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Password confirmation does not match' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Use centralized password reset function
    const resetResult = await resetPassword({
      token,
      newPassword,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    if (!resetResult.success) {
      return NextResponse.json(
        { error: resetResult.error || 'Password reset failed' },
        { status: 400 }
      );
    }

    const duration = Date.now() - startTime;
    logger.info('Password reset successful', {
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Password reset error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Password reset failed' },
      { status: 500 }
    );
  }
}