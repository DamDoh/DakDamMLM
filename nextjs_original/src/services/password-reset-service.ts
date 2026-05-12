/**
 * PASSWORD RESET SERVICE
 * 
 * Handles secure password reset with token validation
 * 
 * Features:
 * - Cryptographically secure tokens
 * - Token expiry (1 hour)
 * - One-time use tokens
 * - IP and user agent tracking
 * - Rate limiting
 * 
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { hashPassword } from '@/lib/auth-service';
import { randomBytes } from 'crypto';

const TOKEN_EXPIRY_HOURS = 1;
const MAX_RESET_ATTEMPTS_PER_HOUR = 3;

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface ResetRequestData {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Generate a cryptographically secure reset token
 */
function generateSecureToken(): string {
  return randomBytes(48).toString('hex');
}

/**
 * Generate password reset token
 */
export async function generateResetToken(data: ResetRequestData): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true, active: true }
    });

    if (!user) {
      // Don't reveal if email exists (security best practice)
      logger.warn('Password reset requested for non-existent email', {
        email: data.email,
        ipAddress: data.ipAddress
      });
      return {
        success: true // Return success to prevent email enumeration
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: 'Account is deactivated'
      };
    }

    // Rate limiting - check recent attempts
    const recentAttempts = await prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    if (recentAttempts >= MAX_RESET_ATTEMPTS_PER_HOUR) {
      logger.warn('Too many password reset attempts', {
        userId: user.id,
        attempts: recentAttempts,
        ipAddress: data.ipAddress
      });
      return {
        success: false,
        error: 'Too many reset attempts. Please try again later.'
      };
    }

    // Clean up old unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { lt: new Date() }
      }
    });

    // Generate token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      }
    });

    logger.info('Password reset token generated', {
      userId: user.id,
      expiresAt,
      ipAddress: data.ipAddress
    });

    return {
      success: true,
      token
    };
  } catch (error) {
    logger.error('Failed to generate reset token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: data.email
    });
    return {
      success: false,
      error: 'Failed to generate reset token'
    };
  }
}

/**
 * Send password reset email
 * NOTE: Integrate with your email service
 */
export async function sendResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  try {
    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    logger.info('Password reset email prepared', {
      email,
      resetUrl: resetUrl.replace(token, 'TOKEN_HIDDEN')
    });

    // TODO: Integrate with actual email service
    // Example with SendGrid:
    // await sendGrid.send({
    //   to: email,
    //   from: 'noreply@yourcompany.com',
    //   subject: 'Reset Your Password',
    //   html: emailTemplate(resetUrl)
    // });

    // For development, log the reset URL
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=================================');
      console.log('PASSWORD RESET LINK:');
      console.log(resetUrl);
      console.log('Token expires in 1 hour');
      console.log('=================================\n');
    }

    return true;
  } catch (error) {
    logger.error('Failed to send reset email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email
    });
    return false;
  }
}

/**
 * Validate a reset token
 */
export async function validateResetToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        userId: true,
        used: true,
        expiresAt: true
      }
    });

    if (!resetToken) {
      return {
        valid: false,
        error: 'Invalid reset token'
      };
    }

    if (resetToken.used) {
      return {
        valid: false,
        error: 'Reset token has already been used'
      };
    }

    if (resetToken.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'Reset token has expired'
      };
    }

    return {
      valid: true,
      userId: resetToken.userId
    };
  } catch (error) {
    logger.error('Failed to validate reset token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: 'TOKEN_HIDDEN'
    });
    return {
      valid: false,
      error: 'Token validation failed'
    };
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(data: ResetPasswordData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Validate token
    const validation = await validateResetToken(data.token);
    if (!validation.valid || !validation.userId) {
      return {
        success: false,
        error: validation.error || 'Invalid token'
      };
    }

    // Validate new password
    if (data.newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long'
      };
    }

    // Hash new password
    const hashedPassword = await hashPassword(data.newPassword);

    // Update password and mark token as used in a transaction
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: validation.userId },
        data: { password: hashedPassword }
      });

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { token: data.token },
        data: {
          used: true,
          usedAt: new Date()
        }
      });
    });

    logger.info('Password reset successfully', {
      userId: validation.userId,
      ipAddress: data.ipAddress
    });

    // Security log
    logger.security('Password changed via reset token', undefined, {
      userId: validation.userId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to reset password', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: 'TOKEN_HIDDEN'
    });
    return {
      success: false,
      error: 'Failed to reset password'
    };
  }
}

/**
 * Expire/invalidate a reset token
 */
export async function expireToken(token: string): Promise<boolean> {
  try {
    await prisma.passwordResetToken.update({
      where: { token },
      data: {
        used: true,
        usedAt: new Date()
      }
    });

    logger.info('Reset token expired', {
      token: 'TOKEN_HIDDEN'
    });

    return true;
  } catch (error) {
    logger.error('Failed to expire token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: 'TOKEN_HIDDEN'
    });
    return false;
  }
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredResetTokens(): Promise<number> {
  try {
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            used: true,
            usedAt: {
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days old
            }
          }
        ]
      }
    });

    logger.info('Cleaned up expired reset tokens', {
      count: result.count
    });

    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup expired reset tokens', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

/**
 * Get reset token statistics
 */
export async function getResetTokenStatistics(): Promise<{
  totalGenerated: number;
  used: number;
  expired: number;
  active: number;
}> {
  try {
    const now = new Date();

    const [total, used, expired] = await Promise.all([
      prisma.passwordResetToken.count(),
      prisma.passwordResetToken.count({ where: { used: true } }),
      prisma.passwordResetToken.count({
        where: {
          used: false,
          expiresAt: { lt: now }
        }
      })
    ]);

    return {
      totalGenerated: total,
      used,
      expired,
      active: total - used - expired
    };
  } catch (error) {
    logger.error('Failed to get reset token statistics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      totalGenerated: 0,
      used: 0,
      expired: 0,
      active: 0
    };
  }
}