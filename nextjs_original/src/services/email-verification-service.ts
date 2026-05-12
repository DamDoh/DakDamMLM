/**
 * EMAIL VERIFICATION SERVICE
 * 
 * Handles email verification for user and company registrations
 * 
 * Features:
 * - Secure token generation
 * - Email verification tracking
 * - Token expiry (24 hours)
 * - Resend capability
 * 
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';

const TOKEN_EXPIRY_HOURS = 24;
const MAX_RESEND_ATTEMPTS = 3;

export interface EmailVerificationToken {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  companyId?: string;
}

/**
 * Generate a cryptographically secure verification token
 */
function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate and store an email verification token
 */
export async function generateVerificationToken(
  email: string,
  companyId?: string
): Promise<{ token: string; expiresAt: Date }> {
  try {
    // Clean up old unverified tokens for this email
    await prisma.emailVerification.deleteMany({
      where: {
        email: email.toLowerCase(),
        verified: false,
        expiresAt: { lt: new Date() }
      }
    });

    // Check if email is already verified
    const existingVerified = await prisma.emailVerification.findFirst({
      where: {
        email: email.toLowerCase(),
        verified: true
      }
    });

    if (existingVerified) {
      logger.warn('Email already verified', { email });
      throw new Error('Email is already verified');
    }

    // Check recent unverified tokens (rate limiting)
    const recentTokens = await prisma.emailVerification.count({
      where: {
        email: email.toLowerCase(),
        verified: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    if (recentTokens >= MAX_RESEND_ATTEMPTS) {
      logger.warn('Too many verification attempts', { email, attempts: recentTokens });
      throw new Error('Too many verification emails sent. Please try again later.');
    }

    // Generate token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token
    await prisma.emailVerification.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt,
        companyId
      }
    });

    logger.info('Email verification token generated', {
      email,
      expiresAt
    });

    return { token, expiresAt };
  } catch (error) {
    logger.error('Failed to generate verification token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email
    });
    throw error;
  }
}

/**
 * Send verification email
 * NOTE: This is a placeholder - integrate with your email service (SendGrid, AWS SES, etc.)
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<boolean> {
  try {
    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    logger.info('Verification email prepared', {
      email,
      verificationUrl: verificationUrl.replace(token, 'TOKEN_HIDDEN')
    });

    // TODO: Integrate with actual email service
    // Example with SendGrid:
    // await sendGrid.send({
    //   to: email,
    //   from: 'noreply@yourcompany.com',
    //   subject: 'Verify Your Email Address',
    //   html: emailTemplate(verificationUrl, companyName)
    // });

    // For development, log the verification URL
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=================================');
      console.log('EMAIL VERIFICATION LINK:');
      console.log(verificationUrl);
      console.log('=================================\n');
    }

    return true;
  } catch (error) {
    logger.error('Failed to send verification email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email
    });
    return false;
  }
}

/**
 * Verify an email using the provided token
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    // Find token
    const verification = await prisma.emailVerification.findUnique({
      where: { token }
    });

    if (!verification) {
      return {
        success: false,
        error: 'Invalid verification token'
      };
    }

    // Check if already verified
    if (verification.verified) {
      return {
        success: false,
        error: 'Email already verified'
      };
    }

    // Check if expired
    if (verification.expiresAt < new Date()) {
      return {
        success: false,
        error: 'Verification token has expired'
      };
    }

    // Mark as verified
    await prisma.emailVerification.update({
      where: { token },
      data: { verified: true }
    });

    logger.info('Email verified successfully', {
      email: verification.email
    });

    return {
      success: true,
      email: verification.email
    };
  } catch (error) {
    logger.error('Failed to verify email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: 'TOKEN_HIDDEN'
    });
    return {
      success: false,
      error: 'Verification failed'
    };
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Check if email is already verified
    const verified = await checkVerificationStatus(email);
    if (verified) {
      return {
        success: false,
        error: 'Email is already verified'
      };
    }

    // Generate new token
    const { token } = await generateVerificationToken(email);

    // Send email
    const sent = await sendVerificationEmail(email, token);

    if (!sent) {
      return {
        success: false,
        error: 'Failed to send verification email'
      };
    }

    return { success: true };
  } catch (error) {
    logger.error('Failed to resend verification email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend email'
    };
  }
}

/**
 * Check if an email has been verified
 */
export async function checkVerificationStatus(email: string): Promise<boolean> {
  try {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email: email.toLowerCase(),
        verified: true
      }
    });

    return !!verification;
  } catch (error) {
    logger.error('Failed to check verification status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email
    });
    return false;
  }
}

/**
 * Clean up expired verification tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await prisma.emailVerification.deleteMany({
      where: {
        verified: false,
        expiresAt: { lt: new Date() }
      }
    });

    logger.info('Cleaned up expired verification tokens', {
      count: result.count
    });

    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

/**
 * Get verification statistics
 */
export async function getVerificationStatistics(companyId?: string): Promise<{
  total: number;
  verified: number;
  pending: number;
  expired: number;
}> {
  try {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const now = new Date();

    const [total, verified, expired] = await Promise.all([
      prisma.emailVerification.count({ where }),
      prisma.emailVerification.count({ where: { ...where, verified: true } }),
      prisma.emailVerification.count({
        where: {
          ...where,
          verified: false,
          expiresAt: { lt: now }
        }
      })
    ]);

    return {
      total,
      verified,
      pending: total - verified - expired,
      expired
    };
  } catch (error) {
    logger.error('Failed to get verification statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      total: 0,
      verified: 0,
      pending: 0,
      expired: 0
    };
  }
}