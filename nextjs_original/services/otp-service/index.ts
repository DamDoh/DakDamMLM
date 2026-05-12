// OTP (One-Time Password) Microservice
// Handles secure OTP generation, validation, and delivery for email/SMS

import crypto from 'crypto';
import { db } from '../shared/database';
import {
  ServiceErrorHandler,
  ResponseUtils,
  ValidationUtils,
  PerformanceUtils,
} from '../shared/utils';
import { eventBus, EventTypes, DomainEventCreators } from '../shared/event-bus';

// OTP Configuration
const OTP_CONFIG = {
  codeLength: 6,
  expiryMinutes: 10,
  maxAttempts: 3,
  rateLimit: {
    perHour: 5,
    perDay: 20,
  },
  cleanup: {
    intervalHours: 24, // Clean up expired codes every 24 hours
  },
};

export interface OtpRequest {
  identifier: string; // Email or phone number
  type: 'email' | 'sms';
  purpose: 'verification' | 'password_reset' | 'login_2fa' | 'transaction';
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface OtpVerification {
  identifier: string;
  type: 'email' | 'sms';
  purpose: 'verification' | 'password_reset' | 'login_2fa' | 'transaction';
  code: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface OtpResponse {
  success: boolean;
  otpId?: string;
  expiresAt?: string;
  error?: string;
  nextAttemptAt?: string;
}

export interface OtpVerificationResponse {
  success: boolean;
  otpId?: string;
  verifiedAt?: string;
  error?: string;
  attemptsRemaining?: number;
}

class OtpService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  // Generate a secure OTP code
  private generateOtpCode(): string {
    const digits = '0123456789';
    let code = '';

    for (let i = 0; i < OTP_CONFIG.codeLength; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }

    return code;
  }

  // Hash the OTP code for secure storage
  private hashOtpCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  // Verify OTP code against hash
  private verifyOtpCode(code: string, hashedCode: string): boolean {
    const inputHash = this.hashOtpCode(code);
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(hashedCode, 'hex')
    );
  }

  // Check rate limits for OTP requests
  private async checkRateLimit(
    identifier: string,
    type: 'email' | 'sms',
    companyId?: string
  ): Promise<{ allowed: boolean; nextAttemptAt?: string }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count recent OTP requests
    const recentRequests = await db.otpCode.count({
      where: {
        identifier,
        type,
        companyId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    const dailyRequests = await db.otpCode.count({
      where: {
        identifier,
        type,
        companyId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    // Check hourly limit
    if (recentRequests >= OTP_CONFIG.rateLimit.perHour) {
      const nextAttemptAt = new Date(now.getTime() + 60 * 60 * 1000);
      return { allowed: false, nextAttemptAt: nextAttemptAt.toISOString() };
    }

    // Check daily limit
    if (dailyRequests >= OTP_CONFIG.rateLimit.perDay) {
      const nextAttemptAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      return { allowed: false, nextAttemptAt: nextAttemptAt.toISOString() };
    }

    return { allowed: true };
  }

  // Generate and send OTP
  async generateOtp(request: OtpRequest): Promise<OtpResponse> {
    const timerId = PerformanceUtils.startTimer('generateOtp');

    try {
      const { identifier, type, purpose, companyId, ipAddress, userAgent, metadata } = request;

      // Validate input
      if (!identifier || !type || !purpose) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Identifier, type, and purpose are required');
      }

      if (!['email', 'sms'].includes(type)) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Type must be email or sms');
      }

      if (!['verification', 'password_reset', 'login_2fa', 'transaction'].includes(purpose)) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid purpose');
      }

      // Validate identifier format
      if (type === 'email' && !ValidationUtils.isValidEmail(identifier)) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid email format');
      }

      if (type === 'sms' && !ValidationUtils.isValidPhoneNumber(identifier)) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid phone number format');
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit(identifier, type, companyId);
      if (!rateLimitCheck.allowed) {
        PerformanceUtils.endTimer(timerId);
        return {
          success: false,
          error: 'Rate limit exceeded. Too many OTP requests.',
          nextAttemptAt: rateLimitCheck.nextAttemptAt,
        };
      }

      // Invalidate any existing unverified OTPs for this identifier/purpose combination
      await db.otpCode.updateMany({
        where: {
          identifier,
          type,
          purpose,
          companyId,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          expiresAt: new Date(), // Expire immediately
        },
      });

      // Generate new OTP
      const code = this.generateOtpCode();
      const hashedCode = this.hashOtpCode(code);
      const expiresAt = new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000);

      // Store OTP in database
      const otpRecord = await db.otpCode.create({
        data: {
          identifier,
          type,
          purpose,
          code: hashedCode, // Store hashed version
          expiresAt,
          companyId,
        },
      });

      // Send OTP via appropriate channel
      const deliveryResult = await this.deliverOtp(identifier, type, purpose, code, companyId);

      if (!deliveryResult.success) {
        // Log delivery failure but don't fail the request
        console.error('OTP delivery failed:', deliveryResult.error);

        // Still log the delivery attempt
        await this.logDeliveryAttempt(
          otpRecord.id,
          identifier,
          type,
          'failed',
          deliveryResult.error,
          companyId,
          ipAddress,
          userAgent
        );
      } else {
        // Log successful delivery
        await this.logDeliveryAttempt(
          otpRecord.id,
          identifier,
          type,
          'sent',
          undefined,
          companyId,
          ipAddress,
          userAgent
        );
      }

      // Publish OTP generated event
      await eventBus.publish(DomainEventCreators.otpGenerated(identifier, type, purpose, companyId));

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`OTP: Generated ${type} OTP for ${identifier} in ${duration}ms`);

      return {
        success: true,
        otpId: otpRecord.id,
        expiresAt: expiresAt.toISOString(),
      };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to generate OTP:', error);
      throw ServiceErrorHandler.createError('OTP_ERROR', 'Failed to generate OTP');
    }
  }

  // Verify OTP code
  async verifyOtp(request: OtpVerification): Promise<OtpVerificationResponse> {
    const timerId = PerformanceUtils.startTimer('verifyOtp');

    try {
      const { identifier, type, purpose, code, companyId, ipAddress, userAgent } = request;

      // Validate input
      if (!identifier || !type || !purpose || !code) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'All fields are required');
      }

      // Find the most recent unverified OTP for this identifier/purpose
      const otpRecord = await db.otpCode.findFirst({
        where: {
          identifier,
          type,
          purpose,
          companyId,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
          attempts: {
            lt: OTP_CONFIG.maxAttempts,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!otpRecord) {
        PerformanceUtils.endTimer(timerId);
        return {
          success: false,
          error: 'No valid OTP found or OTP has expired',
        };
      }

      // Check if too many attempts
      if (otpRecord.attempts >= OTP_CONFIG.maxAttempts) {
        PerformanceUtils.endTimer(timerId);
        return {
          success: false,
          error: 'Too many verification attempts',
          attemptsRemaining: 0,
        };
      }

      // Increment attempts
      await db.otpCode.update({
        where: { id: otpRecord.id },
        data: {
          attempts: { increment: 1 },
        },
      });

      // Verify the code
      const isValid = this.verifyOtpCode(code, otpRecord.code);

      if (!isValid) {
        const attemptsRemaining = OTP_CONFIG.maxAttempts - (otpRecord.attempts + 1);

        PerformanceUtils.endTimer(timerId);
        return {
          success: false,
          error: 'Invalid OTP code',
          attemptsRemaining: Math.max(0, attemptsRemaining),
        };
      }

      // Mark as verified
      const verifiedAt = new Date();
      await db.otpCode.update({
        where: { id: otpRecord.id },
        data: {
          isActive: false,
        },
      });

      // Publish OTP verified event
      await eventBus.publish(DomainEventCreators.otpVerified(identifier, type, purpose, companyId));

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`OTP: Verified ${type} OTP for ${identifier} in ${duration}ms`);

      return {
        success: true,
        otpId: otpRecord.id,
        verifiedAt: verifiedAt.toISOString(),
      };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to verify OTP:', error);
      throw ServiceErrorHandler.createError('OTP_ERROR', 'Failed to verify OTP');
    }
  }

  // Deliver OTP via email or SMS
  private async deliverOtp(
    identifier: string,
    type: 'email' | 'sms',
    purpose: string,
    code: string,
    companyId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (type === 'email') {
        return await this.deliverEmailOtp(identifier, purpose, code, companyId);
      } else if (type === 'sms') {
        return await this.deliverSmsOtp(identifier, purpose, code, companyId);
      } else {
        return { success: false, error: 'Unsupported delivery type' };
      }
    } catch (error) {
      console.error(`Failed to deliver ${type} OTP:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delivery failed',
      };
    }
  }

  // Deliver OTP via email
  private async deliverEmailOtp(
    email: string,
    purpose: string,
    code: string,
    companyId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import email service dynamically to avoid circular dependencies
      const { getEmailService } = await import('../email-service');
      const emailService = getEmailService();

      // Send OTP email using the email service
      const result = await emailService.sendOtpEmail(email, code, purpose, companyId);

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email delivery failed',
      };
    }
  }

  // Deliver OTP via SMS
  private async deliverSmsOtp(
    phoneNumber: string,
    purpose: string,
    code: string,
    companyId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import SMS service dynamically to avoid circular dependencies
      const { getSmsService } = await import('../sms-service');
      const smsService = getSmsService();

      // Send OTP SMS using the SMS service
      const result = await smsService.sendOtpSms(phoneNumber, code, purpose, companyId);

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS delivery failed',
      };
    }
  }

  // Get email template for purpose
  private getEmailTemplate(purpose: string, settings?: any) {
    const templates = settings?.emailTemplates || {};

    const defaultTemplates: Record<string, { subject: string; body: string }> = {
      verification: {
        subject: 'Verify Your Account',
        body: 'Your verification code is: {{code}}. This code will expire in 10 minutes.',
      },
      password_reset: {
        subject: 'Reset Your Password',
        body: 'Your password reset code is: {{code}}. This code will expire in 10 minutes.',
      },
      login_2fa: {
        subject: 'Login Verification Code',
        body: 'Your login verification code is: {{code}}. This code will expire in 10 minutes.',
      },
      transaction: {
        subject: 'Transaction Verification Code',
        body: 'Your transaction verification code is: {{code}}. This code will expire in 10 minutes.',
      },
    };

    return templates[purpose] || defaultTemplates[purpose] || defaultTemplates.verification;
  }

  // Get SMS template for purpose
  private getSmsTemplate(purpose: string, settings?: any) {
    const templates = settings?.smsTemplates || {};

    const defaultTemplates: Record<string, { message: string }> = {
      verification: {
        message: 'Your verification code is: {{code}}. Expires in 10 minutes.',
      },
      password_reset: {
        message: 'Your password reset code is: {{code}}. Expires in 10 minutes.',
      },
      login_2fa: {
        message: 'Your login code is: {{code}}. Expires in 10 minutes.',
      },
      transaction: {
        message: 'Your transaction code is: {{code}}. Expires in 10 minutes.',
      },
    };

    return templates[purpose] || defaultTemplates[purpose] || defaultTemplates.verification;
  }

  // Log delivery attempt
  private async logDeliveryAttempt(
    otpId: string,
    identifier: string,
    type: 'email' | 'sms',
    status: 'sent' | 'delivered' | 'failed',
    error?: string,
    companyId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await db.otpDeliveryLog.create({
        data: {
          otpId,
          identifier,
          type,
          provider: 'internal_' + type, // internal_email or internal_sms
          status,
          error,
          ipAddress,
          userAgent,
          companyId,
        },
      });
    } catch (logError) {
      console.error('Failed to log OTP delivery:', logError);
    }
  }

  // Clean up expired OTP codes
  async cleanupExpiredOtps(): Promise<number> {
    try {
      const result = await db.otpCode.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } }, // Expired
            { isActive: false }, // Already verified (inactive)
            { attempts: { gte: OTP_CONFIG.maxAttempts } }, // Too many attempts
          ],
        },
      });

      console.log(`OTP: Cleaned up ${result.count} expired OTP codes`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired OTPs:', error);
      return 0;
    }
  }

  // Get OTP statistics
  async getOtpStats(companyId?: string): Promise<any> {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalOtps,
        activeOtps,
        verifiedOtps,
        failedDeliveries,
        recentRequests,
      ] = await Promise.all([
        db.otpCode.count({ where: { companyId } }),
        db.otpCode.count({
          where: {
            companyId,
            isActive: true,
            expiresAt: { gt: now },
            attempts: { lt: OTP_CONFIG.maxAttempts },
          },
        }),
        db.otpCode.count({
          where: {
            companyId,
            isActive: false,
            createdAt: { gte: last24Hours },
          },
        }),
        db.otpDeliveryLog.count({
          where: {
            companyId,
            status: 'failed',
            createdAt: { gte: last24Hours },
          },
        }),
        db.otpCode.count({
          where: {
            companyId,
            createdAt: { gte: last24Hours },
          },
        }),
      ]);

      return {
        totalOtps,
        activeOtps,
        verifiedOtpsLast24h: verifiedOtps,
        failedDeliveriesLast24h: failedDeliveries,
        recentRequestsLast24h: recentRequests,
        successRate: recentRequests > 0 ? ((verifiedOtps / recentRequests) * 100).toFixed(1) : '0',
      };
    } catch (error) {
      console.error('Failed to get OTP stats:', error);
      return null;
    }
  }

  // Start periodic cleanup
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredOtps();
    }, OTP_CONFIG.cleanup.intervalHours * 60 * 60 * 1000);
  }

  // Stop cleanup interval
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; activeOtps: number; timestamp: string }> {
    try {
      const activeOtps = await db.otpCode.count({
        where: {
          isActive: true,
          expiresAt: { gt: new Date() },
          attempts: { lt: OTP_CONFIG.maxAttempts },
        },
      });

      return {
        status: 'healthy',
        activeOtps,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        activeOtps: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let otpServiceInstance: OtpService | null = null;

function getOtpService(): OtpService {
  if (!otpServiceInstance) {
    otpServiceInstance = new OtpService();
  }
  return otpServiceInstance;
}

// Server actions for API routes
export async function generateOtpServer(request: OtpRequest): Promise<OtpResponse> {
  try {
    const service = getOtpService();
    return await service.generateOtp(request);
  } catch (error) {
    console.error('Failed to generate OTP:', error);
    throw error;
  }
}

export async function verifyOtpServer(request: OtpVerification): Promise<OtpVerificationResponse> {
  try {
    const service = getOtpService();
    return await service.verifyOtp(request);
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    throw error;
  }
}

export async function cleanupExpiredOtpsServer(): Promise<number> {
  try {
    const service = getOtpService();
    return await service.cleanupExpiredOtps();
  } catch (error) {
    console.error('Failed to cleanup expired OTPs:', error);
    return 0;
  }
}

export async function getOtpStatsServer(companyId?: string): Promise<any> {
  try {
    const service = getOtpService();
    return await service.getOtpStats(companyId);
  } catch (error) {
    console.error('Failed to get OTP stats:', error);
    return null;
  }
}

export { getOtpService };
export default getOtpService;