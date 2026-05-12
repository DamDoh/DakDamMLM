import { NextRequest, NextResponse } from 'next/server';
import { loginUser, ValidationError, AuthenticationError } from '@/lib/auth';
import { rateLimit, createAuthRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for authentication attempts
    // Note: Rate limit is checked before login attempt to prevent brute force attacks
    const rateLimitResult = await rateLimit(request, createAuthRateLimit());
    if (!rateLimitResult.success) {
      const retryAfter = rateLimitResult.resetTime 
        ? Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) 
        : 900; // Default to 15 minutes
      const retryAfterMinutes = Math.ceil(retryAfter / 60);
      
      logger.warn('Rate limit exceeded for login attempt', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        retryAfterMinutes
      }, request);
      
      // Return the rate limit response with helpful message
      return rateLimitResult.response!;
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.error('Failed to parse request body', { error: error instanceof Error ? error.message : String(error) }, request);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    const { memberId, password } = body;

    // Normalize empty strings to undefined for consistent validation
    const normalizedMemberId = memberId && memberId.trim() ? memberId.trim() : undefined;
    const normalizedPassword = password && password.trim() ? password.trim() : undefined;

    // Use centralized validation from auth-service
    if (!normalizedMemberId || !normalizedPassword) {
      logger.warn('Login attempt with missing credentials', { 
        memberId: !!normalizedMemberId, 
        password: !!normalizedPassword,
        bodyKeys: Object.keys(body)
      }, request);
      return NextResponse.json(
        { error: 'Member ID and password are required' },
        { status: 400 }
      );
    }

    // Log the received credentials for debugging (without sensitive data)
    logger.info('Login attempt', {
      hasMemberId: !!normalizedMemberId,
      memberIdLength: normalizedMemberId?.length,
      passwordLength: normalizedPassword?.length
    }, request);

    // FIXED: Removed duplicate lockout logic
    // Account lockout is now handled entirely in services/auth-service/index.ts
    // This prevents double-incrementing and keeps logic in one place
    
    const loginResult = await loginUser({
      memberId: normalizedMemberId,
      password: normalizedPassword
    });

    // If login is successful and rate limiter supports it, don't count this request
    // (This helps legitimate users who might have multiple devices or retry after typos)
    if (rateLimitResult.decrement) {
      rateLimitResult.decrement();
    }

    const duration = Date.now() - startTime;

    if (loginResult.requiresMFA) {
      logger.info('Login requires MFA', {
        email: loginResult.user.email,
        memberId: normalizedMemberId,
        userId: loginResult.user.id,
        duration,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      }, request);

      return NextResponse.json({
        success: true,
        requiresMFA: true,
        mfaMethods: loginResult.mfaMethods,
        user: {
          id: loginResult.user.id,
          email: loginResult.user.email,
          memberId: loginResult.user.memberId,
          fullName: loginResult.user.fullName,
          isAdmin: loginResult.user.isAdmin,
          accountType: loginResult.user.accountType
        },
        // Include a temporary session token for MFA verification
        sessionToken: generateTokens(loginResult.user).accessToken
      });
    }

    logger.info('Login successful', {
      email: loginResult.user.email,
      memberId: normalizedMemberId,
      userId: loginResult.user.id,
      duration,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    }, request);

    const response = NextResponse.json({
      success: true,
      user: {
        id: loginResult.user.id,
        email: loginResult.user.email,
        memberId: loginResult.user.memberId,
        fullName: loginResult.user.fullName,
        isAdmin: loginResult.user.isAdmin,
        accountType: loginResult.user.accountType
      },
      tokens: loginResult.tokens
    });

    // Add rate limit headers to response
    if (rateLimitResult.limit !== undefined) {
      const remaining = rateLimitResult.decrement 
        ? (rateLimitResult.remaining || 0) + 1 // Add 1 back since we decremented
        : rateLimitResult.remaining || 0;
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      if (rateLimitResult.resetTime) {
        response.headers.set('X-RateLimit-Reset', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());
      }
    }

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Login error', {
      error: errorMessage,
      errorStack,
      duration,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      errorName: error instanceof Error ? error.constructor.name : typeof error
    }, request);

    // Log to console for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Login error details:', {
        error: errorMessage,
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
    }

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

    // Return more detailed error in development, generic in production
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Internal server error: ${errorMessage}` 
          : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}