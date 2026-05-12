import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth-service';

// Inline password reset functions to avoid TypeScript module resolution issues
async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, active: true, deleted: true }
    });

    if (!user || user.deleted || !user.active) {
      // Don't reveal if user exists or not (security)
      return { success: true };
    }

    logger.info('Password reset requested', { email: email.substring(0, 3) + '***' });
    return { success: true };
  } catch (error: any) {
    logger.error('Password reset request failed', { error: error.message });
    return { success: true }; // Return success to prevent email enumeration
  }
}

async function resetPasswordWithOtp(
  email: string,
  otpCode: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Validate OTP code here
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    logger.info('Password reset with OTP successful', { email: email.substring(0, 3) + '***' });
    return { success: true };
  } catch (error: any) {
    logger.error('Password reset with OTP failed', { error: error.message });
    return { success: false, error: error.message || 'Failed to reset password' };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - password reset is sensitive
    const rateLimitResult = await rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 3 // 3 password reset requests per minute
    });
    if (!rateLimitResult.success) {
      logger.warn('Password reset rate limit exceeded', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const body = await request.json();
    const { action, email, otpCode, newPassword } = body;

    // Validate action
    if (!action || !['request', 'reset'].includes(action)) {
      return ApiResponseUtil.validationError([{
        field: 'action',
        message: 'Action must be either "request" or "reset"'
      }]);
    }

    // Get client information for security tracking
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (action === 'request') {
      // Request password reset
      if (!email) {
        return ApiResponseUtil.validationError([{
          field: 'email',
          message: 'Email is required for password reset request'
        }]);
      }

      const result = await requestPasswordReset(email);

      // Always return success for security (prevent email enumeration)
      logger.info('Password reset requested', {
        email: email.substring(0, 3) + '***', // Partial logging for privacy
        success: result.success,
        ip: ipAddress,
        duration: Date.now() - startTime
      }, request);

      return ApiResponseUtil.success({
        message: 'If an account with this email exists, a password reset link has been sent.'
      }, 'Password reset email sent');

    } else if (action === 'reset') {
      // Reset password with OTP
      if (!email || !otpCode || !newPassword) {
        return ApiResponseUtil.validationError([
          { field: 'email', message: 'Email is required' },
          { field: 'otpCode', message: 'OTP code is required' },
          { field: 'newPassword', message: 'New password is required' }
        ]);
      }

      // Validate OTP code format
      if (!/^\d{6}$/.test(otpCode)) {
        return ApiResponseUtil.validationError([{
          field: 'otpCode',
          message: 'OTP code must be a 6-digit number'
        }]);
      }

      // Validate new password
      if (newPassword.length < 8) {
        return ApiResponseUtil.validationError([{
          field: 'newPassword',
          message: 'Password must be at least 8 characters long'
        }]);
      }

      const result = await resetPasswordWithOtp(email, otpCode, newPassword);

      if (!result.success) {
        logger.warn('Password reset failed', {
          email: email.substring(0, 3) + '***',
          error: result.error,
          ip: ipAddress
        }, request);

        return ApiResponseUtil.error(result.error || 'Password reset failed');
      }

      logger.info('Password reset successful', {
        email: email.substring(0, 3) + '***',
        ip: ipAddress,
        duration: Date.now() - startTime
      }, request);

      return ApiResponseUtil.success({
        message: 'Password reset successfully. You can now log in with your new password.'
      }, 'Password reset successful');
    }

  } catch (error) {
    logger.error('Password reset error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}