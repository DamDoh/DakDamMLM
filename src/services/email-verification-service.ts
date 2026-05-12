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
 * Create HTML email template for verification
 */
function createVerificationEmailTemplate(
  verificationUrl: string,
  companyName?: string
): string {
  const appName = companyName || 'DakDam Portal';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email Address</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 20px; text-align: center; background-color: #ffffff;">
              <h1 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">
                Verify Your Email Address
              </h1>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Thank you for registering with ${appName}. Please verify your email address by clicking the button below:
              </p>
              <table role="presentation" style="margin: 30px auto;">
                <tr>
                  <td style="background-color: #007bff; border-radius: 5px; padding: 12px 30px;">
                    <a href="${verificationUrl}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px 0; color: #007bff; font-size: 12px; word-break: break-all;">
                ${verificationUrl}
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                This verification link will expire in 24 hours. If you didn't create an account with ${appName}, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send verification email using SMTP (if configured) or log to console (development)
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  companyName?: string
): Promise<boolean> {
  try {
    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    logger.info('Verification email prepared', {
      email,
      companyName,
      verificationUrl: verificationUrl.replace(token, 'TOKEN_HIDDEN')
    });

    // Check if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || 'noreply@dakdam.app';
    const smtpFromName = process.env.SMTP_FROM_NAME || companyName || 'DakDam Portal';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    // If SMTP is configured, send email via SMTP
    if (smtpHost && smtpUser && smtpPassword) {
      try {
        // Dynamic import to avoid bundling nodemailer in browser
        const nodemailer = await import('nodemailer');

        // Create transporter
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure, // true for 465, false for other ports
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
          // Additional security options
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
            minVersion: 'TLSv1.2'
          }
        });

        // Verify connection
        await transporter.verify();

        // Create email template
        const htmlContent = createVerificationEmailTemplate(verificationUrl, companyName);
        const textContent = `Verify your email address for ${companyName || 'DakDam Portal'}\n\nClick this link to verify: ${verificationUrl}\n\nThis link expires in 24 hours.`;

        // Send email
        const info = await transporter.sendMail({
          from: `"${smtpFromName}" <${smtpFromEmail}>`,
          to: email,
          subject: `Verify Your Email Address - ${companyName || 'DakDam Portal'}`,
          html: htmlContent,
          text: textContent,
        });

        logger.info('Verification email sent successfully via SMTP', {
          email,
          messageId: info.messageId,
          companyName
        });

        return true;
      } catch (smtpError: any) {
        logger.error('SMTP email sending failed', {
          error: smtpError instanceof Error ? smtpError.message : 'Unknown error',
          email,
          smtpHost,
          smtpErrorCode: (smtpError as any)?.code
        });

        // In production, fail if SMTP is configured but fails
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Failed to send email via SMTP: ${smtpError instanceof Error ? smtpError.message : 'Unknown error'}`);
        }

        // In development, fall through to console logging
        logger.warn('Falling back to console logging due to SMTP error');
      }
    }

    // Fallback: Log to console (development mode or SMTP not configured)
    if (process.env.NODE_ENV === 'development' || !smtpHost) {
      console.log('\n=================================');
      console.log('EMAIL VERIFICATION LINK:');
      console.log(`For: ${email}${companyName ? ` (${companyName})` : ''}`);
      console.log(verificationUrl);
      console.log('=================================\n');

      logger.info('Verification email logged to console (SMTP not configured or development mode)', {
        email,
        companyName
      });
    }

    return true;
  } catch (error) {
    logger.error('Failed to send verification email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email,
      stack: error instanceof Error ? error.stack : undefined
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
