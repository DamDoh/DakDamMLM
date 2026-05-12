import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { getTotpService } from '@/services/totp-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { sessionToken, mfaCode, method = 'totp' } = body;

    if (!sessionToken || !mfaCode) {
      return NextResponse.json(
        { error: 'Session token and MFA code are required' },
        { status: 400 }
      );
    }

    // Verify the session token to get user info
    const user = verifyToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired session token' },
        { status: 401 }
      );
    }

    // For now, implement basic TOTP verification
    // In production, this should check against user's stored TOTP secret
    const totpService = getTotpService();
    const verification = await totpService.verifyTotp(user.id, mfaCode);

    if (!verification.success) {
      logger.warn('MFA verification failed', {
        userId: user.id,
        method,
        error: verification.error
      });

      return NextResponse.json(
        { error: verification.error || 'Invalid MFA code' },
        { status: 401 }
      );
    }

    // Generate final tokens after successful MFA verification
    const { generateTokens } = await import('@/lib/auth-service');
    const tokens = generateTokens(user);

    logger.info('MFA verification successful', {
      userId: user.id,
      method,
      remainingTime: verification.remainingTime
    });

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
      tokens,
      message: 'MFA verification successful'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('MFA verification error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\auth\mfa\verify\route.ts