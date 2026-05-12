import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/csrf-protection';
import { logger } from '@/lib/logger';

/**
 * CSRF Token Endpoint
 * 
 * Provides CSRF tokens for client-side forms.
 * Call this before submitting forms with POST/PUT/DELETE requests.
 */

export async function GET(request: NextRequest) {
  try {
    // Generate new CSRF token
    const token = generateCSRFToken();

    const response = NextResponse.json({
      success: true,
      token,
      expiresIn: 24 * 60 * 60 // 24 hours in seconds
    });

    // Set secure cookie
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    logger.debug('CSRF token generated', {
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return response;
  } catch (error) {
    logger.error('Failed to generate CSRF token', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, request);

    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}