import { NextRequest, NextResponse } from 'next/server';
import { loginUser, ValidationError, AuthenticationError } from '@/lib/auth';
import { rateLimit, createAuthRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for authentication attempts
    const rateLimitResult = await rateLimit(request, createAuthRateLimit());
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for login attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const { memberId, password } = await request.json();

    // Use centralized validation from auth-service
    if (!memberId || !password) {
      logger.warn('Login attempt with missing credentials', { memberId: !!memberId, password: !!password }, request);
      return NextResponse.json(
        { error: 'Member ID and password are required' },
        { status: 400 }
      );
    }

    // FIXED: Removed duplicate lockout logic
    // Account lockout is now handled entirely in services/auth-service/index.ts
    // This prevents double-incrementing and keeps logic in one place
    
    const loginResult = await loginUser({ memberId, password });
    
    if (!loginResult) {
      throw new AuthenticationError('Invalid member ID or password');
    }
    
    const { user, tokens } = loginResult;

    const duration = Date.now() - startTime;
    logger.info('Login successful', {
      memberId,
      userId: user.id,
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        memberId: user.memberId,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
        accountType: user.accountType
      },
      tokens
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Login error', {
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