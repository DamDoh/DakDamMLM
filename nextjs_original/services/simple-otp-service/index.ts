// Simple OTP Service for Traditional Web Hosting
// Eliminates third-party OTP dependencies while working on shared hosting

import crypto from 'crypto';
import { db } from '../shared/database';
import { getEmailService } from '../email-service';

export interface SimpleOTPRequest {
  identifier: string; // email or phone
  type: 'email' | 'sms';
  purpose: 'verification' | 'password_reset' | 'login_2fa';
  companyId?: string;
}

export interface SimpleOTPResponse {
  success: boolean;
  otpId?: string;
  error?: string;
  message?: string;
}

export interface SimpleOTPVerification {
  identifier: string;
  code: string;
  purpose: 'verification' | 'password_reset' | 'login_2fa';
  companyId?: string;
}

class SimpleOTPService {
  private static readonly CODE_LENGTH = 6;
  private static readonly CODE_EXPIRY_MINUTES = 10;
  private static readonly MAX_ATTEMPTS = 3;
  private mailService: ReturnType<typeof getEmailService>;

  constructor() {
    // Initialize email service
    this.mailService = getEmailService();
    // Load configuration (will use env vars or database config)
    this.mailService.loadConfig().catch(err => {
      console.warn('Email service configuration failed:', err);
    });
  }

  // Generate a random OTP code
  private generateCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < SimpleOTPService.CODE_LENGTH; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }

  // Hash the OTP code for storage
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  // Verify OTP code with timing-safe comparison
  private verifyCode(storedHash: string, providedCode: string): boolean {
    const providedHash = this.hashCode(providedCode);
    return crypto.timingSafeEqual(
      Buffer.from(storedHash, 'hex'),
      Buffer.from(providedHash, 'hex')
    );
  }

  // Send OTP via email using email service
  private async sendEmailOTP(email: string, code: string, purpose: string, companyId?: string): Promise<boolean> {
    try {
      // Use the email service
      const result = await this.mailService.sendOtpEmail(email, code, purpose, companyId);
      return result.success;
    } catch (error) {
      console.error('Failed to send email OTP:', error);
      return false;
    }
  }

  // Send OTP via SMS (placeholder - implement based on your SMS provider)
  private async sendSMSOTP(phone: string, code: string, purpose: string): Promise<boolean> {
    try {
      const message = this.getSMSMessage(code, purpose);

      console.log(`📱 [SIMULATED SMS] To: ${phone}`);
      console.log(`Message: ${message}`);

      // For actual implementation, integrate with your SMS provider:
      /*
      // Example with a simple SMS API:
      const response = await fetch('https://your-sms-provider.com/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          message: message,
          apiKey: process.env.SMS_API_KEY
        })
      });

      return response.ok;
      */

      return true; // Simulated success

    } catch (error) {
      console.error('Failed to send SMS OTP:', error);
      return false;
    }
  }

  // Get email subject based on purpose
  private getEmailSubject(purpose: string): string {
    const subjects = {
      verification: 'Verify Your Account',
      password_reset: 'Reset Your Password',
      login_2fa: 'Login Verification Code'
    };
    return subjects[purpose as keyof typeof subjects] || 'Verification Code';
  }

  // Get email message template
  private getEmailMessage(code: string, purpose: string): string {
    const expiryMinutes = SimpleOTPService.CODE_EXPIRY_MINUTES;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verification Code</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .code { font-size: 24px; font-weight: bold; color: #007bff; background: #f8f9fa; padding: 10px; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { font-size: 12px; color: #666; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h2>Your Verification Code</h2>

      <p>Your verification code is:</p>

      <div class="code">${code}</div>

      <p>This code will expire in ${expiryMinutes} minutes.</p>

      <p>If you didn't request this code, please ignore this email.</p>

      <div class="footer">
        <p>This is an automated message. Please do not reply.</p>
      </div>
    </body>
    </html>
    `;
  }

  // Get SMS message template
  private getSMSMessage(code: string, purpose: string): string {
    const expiryMinutes = SimpleOTPService.CODE_EXPIRY_MINUTES;
    return `Your verification code is: ${code}. Expires in ${expiryMinutes} minutes.`;
  }

  // Generate and send OTP
  async generateOTP(request: SimpleOTPRequest): Promise<SimpleOTPResponse> {
    try {
      const { identifier, type, purpose, companyId } = request;

      // Validate input
      if (!identifier || !type || !purpose) {
        return {
          success: false,
          error: 'Missing required fields: identifier, type, purpose'
        };
      }

      if (!['email', 'sms'].includes(type)) {
        return {
          success: false,
          error: 'Type must be either "email" or "sms"'
        };
      }

      if (!['verification', 'password_reset', 'login_2fa'].includes(purpose)) {
        return {
          success: false,
          error: 'Invalid purpose'
        };
      }

      // Generate OTP code
      const code = this.generateCode();
      const hashedCode = this.hashCode(code);
      const expiresAt = new Date(Date.now() + SimpleOTPService.CODE_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in database
      const otpRecord = await db.otpCode.create({
        data: {
          identifier,
          type,
          purpose,
          code: hashedCode, // Store hashed version
          expiresAt,
          attempts: 0,
          companyId,
          isActive: true,
        },
      });

      // Send OTP via appropriate channel
      let sent = false;
      if (type === 'email') {
        sent = await this.sendEmailOTP(identifier, code, purpose, companyId);
      } else if (type === 'sms') {
        sent = await this.sendSMSOTP(identifier, code, purpose);
      }

      if (!sent) {
        // Clean up failed OTP
        await db.otpCode.delete({ where: { id: otpRecord.id } });
        return {
          success: false,
          error: 'Failed to send OTP'
        };
      }

      console.log(`✅ OTP generated and sent to ${identifier} (${type}) for ${purpose}`);

      return {
        success: true,
        otpId: otpRecord.id,
        message: `OTP sent to ${type === 'email' ? 'email' : 'phone number'}`
      };

    } catch (error) {
      console.error('Failed to generate OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate OTP'
      };
    }
  }

  // Verify OTP code
  async verifyOTP(request: SimpleOTPVerification): Promise<SimpleOTPResponse> {
    try {
      const { identifier, code, purpose, companyId } = request;

      // Validate input
      if (!identifier || !code || !purpose) {
        return {
          success: false,
          error: 'Missing required fields'
        };
      }

      // Find active OTP for this identifier and purpose
      const otpRecord = await db.otpCode.findFirst({
        where: {
          identifier,
          purpose,
          companyId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' }, // Get most recent
      });

      if (!otpRecord) {
        return {
          success: false,
          error: 'No valid OTP found'
        };
      }

      // Check attempts
      if (otpRecord.attempts >= SimpleOTPService.MAX_ATTEMPTS) {
        await db.otpCode.update({
          where: { id: otpRecord.id },
          data: { isActive: false }
        });
        return {
          success: false,
          error: 'Too many failed attempts'
        };
      }

      // Verify code
      const isValid = this.verifyCode(otpRecord.code, code);

      if (!isValid) {
        // Increment attempts
        await db.otpCode.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } }
        });

        const remainingAttempts = SimpleOTPService.MAX_ATTEMPTS - (otpRecord.attempts + 1);
        return {
          success: false,
          error: `Invalid code. ${remainingAttempts} attempts remaining.`
        };
      }

      // Mark OTP as used
      await db.otpCode.update({
        where: { id: otpRecord.id },
        data: { isActive: false }
      });

      console.log(`✅ OTP verified for ${identifier} (${purpose})`);

      return {
        success: true,
        otpId: otpRecord.id,
        message: 'OTP verified successfully'
      };

    } catch (error) {
      console.error('Failed to verify OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP'
      };
    }
  }

  // Clean up expired OTPs (call this periodically)
  async cleanupExpiredOTPs(): Promise<number> {
    try {
      const result = await db.otpCode.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isActive: false }
          ]
        },
      });

      console.log(`🧹 Cleaned up ${result.count} expired OTPs`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired OTPs:', error);
      return 0;
    }
  }

  // Get OTP statistics
  async getOTPStats(companyId?: string): Promise<any> {
    try {
      const [
        totalOTPs,
        activeOTPs,
        expiredOTPs,
        recentOTPs,
      ] = await Promise.all([
        db.otpCode.count({ where: { companyId } }),
        db.otpCode.count({
          where: { companyId, isActive: true, expiresAt: { gt: new Date() } }
        }),
        db.otpCode.count({
          where: { companyId, expiresAt: { lt: new Date() } }
        }),
        db.otpCode.count({
          where: {
            companyId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
      ]);

      return {
        totalOTPs,
        activeOTPs,
        expiredOTPs,
        recentOTPsLast24h: recentOTPs,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get OTP stats:', error);
      return {
        totalOTPs: 0,
        activeOTPs: 0,
        expiredOTPs: 0,
        recentOTPsLast24h: 0,
        error: error instanceof Error ? error.message : 'Stats unavailable',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let simpleOTPServiceInstance: SimpleOTPService | null = null;

function getSimpleOTPService(): SimpleOTPService {
  if (!simpleOTPServiceInstance) {
    simpleOTPServiceInstance = new SimpleOTPService();
  }
  return simpleOTPServiceInstance;
}

// Server actions for API routes
export async function generateSimpleOTPServer(request: SimpleOTPRequest): Promise<SimpleOTPResponse> {
  try {
    const service = getSimpleOTPService();
    return await service.generateOTP(request);
  } catch (error) {
    console.error('Failed to generate OTP:', error);
    throw error;
  }
}

export async function verifySimpleOTPServer(request: SimpleOTPVerification): Promise<SimpleOTPResponse> {
  try {
    const service = getSimpleOTPService();
    return await service.verifyOTP(request);
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    throw error;
  }
}

export async function cleanupExpiredOTPsServer(): Promise<number> {
  try {
    const service = getSimpleOTPService();
    return await service.cleanupExpiredOTPs();
  } catch (error) {
    console.error('Failed to cleanup OTPs:', error);
    return 0;
  }
}

export async function getSimpleOTPStatsServer(companyId?: string): Promise<any> {
  try {
    const service = getSimpleOTPService();
    return await service.getOTPStats(companyId);
  } catch (error) {
    console.error('Failed to get OTP stats:', error);
    return null;
  }
}

export { getSimpleOTPService };
export default getSimpleOTPService;