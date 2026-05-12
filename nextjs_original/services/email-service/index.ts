// Email Service - Internal SMTP-based email delivery
// Handles secure email sending for OTP and other notifications

import nodemailer from 'nodemailer';
import { db } from '../shared/database';
import {
  ServiceErrorHandler,
  ValidationUtils,
  PerformanceUtils,
} from '../shared/utils';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  companyId?: string;
  metadata?: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor(config?: EmailConfig) {
    if (config) {
      this.initializeTransporter(config);
    }
  }

  // Initialize SMTP transporter
  private initializeTransporter(config: EmailConfig): void {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // Additional security options
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      },
      pool: true, // Use connection pool for better performance
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  // Load configuration from database
  async loadConfig(companyId?: string): Promise<boolean> {
    try {
      let config: any = null;

      if (companyId) {
        // Try company-specific config first
        config = await db.otpSettings.findUnique({
          where: { companyId },
          select: {
            smtpHost: true,
            smtpPort: true,
            smtpSecure: true,
            smtpUser: true,
            smtpPassword: true,
            smtpFromEmail: true,
            smtpFromName: true,
          },
        });
      }

      // Fall back to environment variables if no company config
      if (!config) {
        config = {
          smtpHost: process.env.SMTP_HOST,
          smtpPort: parseInt(process.env.SMTP_PORT || '587'),
          smtpSecure: process.env.SMTP_SECURE === 'true',
          smtpUser: process.env.SMTP_USER,
          smtpPassword: process.env.SMTP_PASSWORD,
          smtpFromEmail: process.env.SMTP_FROM_EMAIL,
          smtpFromName: process.env.SMTP_FROM_NAME,
        };
      }

      // Validate required config
      if (!config.smtpHost || !config.smtpUser || !config.smtpPassword || !config.smtpFromEmail) {
        console.warn('Email service not configured. OTP emails will be logged instead of sent.');
        return false;
      }

      const emailConfig: EmailConfig = {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
        fromEmail: config.smtpFromEmail,
        fromName: config.smtpFromName || 'MLM Platform',
      };

      this.initializeTransporter(emailConfig);
      return true;
    } catch (error) {
      console.error('Failed to load email configuration:', error);
      return false;
    }
  }

  // Send email
  async send(message: EmailMessage): Promise<EmailResult> {
    const timerId = PerformanceUtils.startTimer('sendEmail');

    try {
      // Ensure transporter is initialized
      if (!this.transporter) {
        const configLoaded = await this.loadConfig(message.companyId);
        if (!configLoaded) {
          // Fallback: log the email instead of sending
          console.log('📧 EMAIL NOT SENT (no config):', {
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          });

          return {
            success: true,
            messageId: 'logged-only-' + Date.now(),
          };
        }
      }

      // Validate email address
      if (!ValidationUtils.isValidEmail(message.to)) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid email address');
      }

      // Prepare email options
      const mailOptions = {
        from: `"${this.config!.fromName}" <${this.config!.fromEmail}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

      // Send email
      const info = await this.transporter!.sendMail(mailOptions);

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`📧 Email sent to ${message.to} in ${duration}ms. MessageId: ${info.messageId}`);

      // Log successful delivery
      await this.logEmailDelivery(message, info.messageId, 'sent');

      return {
        success: true,
        messageId: info.messageId,
      };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      const errorMessage = error instanceof Error ? error.message : 'Email sending failed';
      console.error('Failed to send email:', errorMessage);

      // Log failed delivery
      await this.logEmailDelivery(message, undefined, 'failed', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Send OTP email
  async sendOtpEmail(
    to: string,
    otpCode: string,
    purpose: string,
    companyId?: string
  ): Promise<EmailResult> {
    const templates = {
      verification: {
        subject: 'Verify Your Account - MLM Platform',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verify Your Account</h2>
            <p>Hello,</p>
            <p>Welcome to our MLM Platform! To complete your account verification, please use the following code:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this verification, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
        text: `
          Verify Your Account - MLM Platform

          Hello,

          Welcome to our MLM Platform! To complete your account verification, please use the following code:

          ${otpCode}

          This code will expire in 10 minutes.

          If you didn't request this verification, please ignore this email.

          This is an automated message. Please do not reply to this email.
        `,
      },
      password_reset: {
        subject: 'Reset Your Password - MLM Platform',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>Hello,</p>
            <p>You have requested to reset your password. Use the following code to proceed:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #dc3545; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this password reset, please ignore this email and ensure your account is secure.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
        text: `
          Reset Your Password - MLM Platform

          Hello,

          You have requested to reset your password. Use the following code to proceed:

          ${otpCode}

          This code will expire in 10 minutes.

          If you didn't request this password reset, please ignore this email and ensure your account is secure.

          This is an automated message. Please do not reply to this email.
        `,
      },
      login_2fa: {
        subject: 'Login Verification Code - MLM Platform',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Login Verification</h2>
            <p>Hello,</p>
            <p>For your security, we require additional verification for this login attempt. Use the following code:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #28a745; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If this wasn't you attempting to log in, please change your password immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
        text: `
          Login Verification Code - MLM Platform

          Hello,

          For your security, we require additional verification for this login attempt. Use the following code:

          ${otpCode}

          This code will expire in 10 minutes.

          If this wasn't you attempting to log in, please change your password immediately.

          This is an automated message. Please do not reply to this email.
        `,
      },
      transaction: {
        subject: 'Transaction Verification Code - MLM Platform',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Transaction Verification</h2>
            <p>Hello,</p>
            <p>To complete your transaction, please verify with the following code:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #ffc107; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>Do not share this code with anyone.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
        text: `
          Transaction Verification Code - MLM Platform

          Hello,

          To complete your transaction, please verify with the following code:

          ${otpCode}

          This code will expire in 10 minutes.

          Do not share this code with anyone.

          This is an automated message. Please do not reply to this email.
        `,
      },
    };

    const template = templates[purpose as keyof typeof templates] || templates.verification;

    return await this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      companyId,
      metadata: { purpose, otpCode },
    });
  }

  // Log email delivery
  private async logEmailDelivery(
    message: EmailMessage,
    messageId?: string,
    status: 'sent' | 'failed' = 'sent',
    error?: string
  ): Promise<void> {
    try {
      // Log to database for audit trail
      await db.auditLog.create({
        data: {
          action: 'email_sent',
          entity: 'otp',
          entityId: messageId || 'unknown',
          changes: {
            to: message.to,
            subject: message.subject,
            status,
            error,
            metadata: message.metadata,
          },
          companyId: message.companyId,
        },
      });
    } catch (logError) {
      console.error('Failed to log email delivery:', logError);
    }
  }

  // Test email configuration
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.transporter) {
        return { success: false, error: 'Transporter not initialized' };
      }

      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  // Get email statistics
  async getEmailStats(companyId?: string): Promise<any> {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count emails sent in last 24 hours from audit logs
      const emailCount = await db.auditLog.count({
        where: {
          action: 'email_sent',
          companyId,
          createdAt: { gte: last24Hours },
        },
      });

      return {
        emailsSentLast24h: emailCount,
        configured: !!this.transporter,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      console.error('Failed to get email stats:', error);
      return {
        emailsSentLast24h: 0,
        configured: false,
        error: error instanceof Error ? error.message : 'Stats unavailable',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; configured: boolean; timestamp: string }> {
    try {
      const configured = !!this.transporter;
      let connectionOk = false;

      if (configured) {
        const testResult = await this.testConnection();
        connectionOk = testResult.success;
      }

      return {
        status: configured && connectionOk ? 'healthy' : 'degraded',
        configured,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        configured: false,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let emailServiceInstance: EmailService | null = null;

function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

// Server actions for API routes
export async function sendOtpEmailServer(
  to: string,
  otpCode: string,
  purpose: string,
  companyId?: string
): Promise<EmailResult> {
  try {
    const service = getEmailService();
    return await service.sendOtpEmail(to, otpCode, purpose, companyId);
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
}

export async function testEmailConnectionServer(): Promise<{ success: boolean; error?: string }> {
  try {
    const service = getEmailService();
    return await service.testConnection();
  } catch (error) {
    console.error('Failed to test email connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Test failed' };
  }
}

export async function getEmailStatsServer(companyId?: string): Promise<any> {
  try {
    const service = getEmailService();
    return await service.getEmailStats(companyId);
  } catch (error) {
    console.error('Failed to get email stats:', error);
    return null;
  }
}

export { getEmailService };
export default getEmailService;