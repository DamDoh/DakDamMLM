import { NextRequest, NextResponse } from 'next/server';
import { refreshToken, AuthenticationError } from '@/lib/auth';
import { rateLimit, createAuthRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for refresh token attempts
    const rateLimitResult = await rateLimit(request, createAuthRateLimit());
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for token refresh attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const { refreshToken: token } = await request.json();

    if (!token) {
      logger.warn('Token refresh attempt with missing token', { token: !!token }, request);
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    const tokens = await refreshToken(token);

    const duration = Date.now() - startTime;
    logger.info('Token refresh successful', {
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json({
      success: true,
      data: tokens
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Token refresh error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}