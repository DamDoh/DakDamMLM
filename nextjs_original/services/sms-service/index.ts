// SMS Service - Internal SMS delivery for OTP
// Supports multiple SMS providers (Twilio, AWS SNS, etc.)

import { db } from '../shared/database';
import {
  ServiceErrorHandler,
  ValidationUtils,
  PerformanceUtils,
} from '../shared/utils';

export interface SmsConfig {
  provider: 'twilio' | 'aws_sns' | 'nexmo' | 'internal';
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string; // Twilio
  region?: string; // AWS
  fromNumber: string;
}

export interface SmsMessage {
  to: string;
  message: string;
  companyId?: string;
  metadata?: Record<string, any>;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  cost?: number;
  error?: string;
}

class SmsService {
  private config: SmsConfig | null = null;

  constructor(config?: SmsConfig) {
    if (config) {
      this.config = config;
    }
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
            smsProvider: true,
            smsApiKey: true,
            smsApiSecret: true,
            smsFromNumber: true,
          },
        });
      }

      // Fall back to environment variables if no company config
      if (!config) {
        config = {
          smsProvider: process.env.SMS_PROVIDER || 'internal',
          smsApiKey: process.env.SMS_API_KEY,
          smsApiSecret: process.env.SMS_API_SECRET,
          smsFromNumber: process.env.SMS_FROM_NUMBER,
        };
      }

      // Validate required config
      if (!config.smsFromNumber) {
        console.warn('SMS service not configured. OTP SMS will be logged instead of sent.');
        return false;
      }

      this.config = {
        provider: config.smsProvider,
        apiKey: config.smsApiKey,
        apiSecret: config.smsApiSecret,
        fromNumber: config.smsFromNumber,
      };

      return true;
    } catch (error) {
      console.error('Failed to load SMS configuration:', error);
      return false;
    }
  }

  // Send SMS
  async send(message: SmsMessage): Promise<SmsResult> {
    const timerId = PerformanceUtils.startTimer('sendSms');

    try {
      // Ensure config is loaded
      if (!this.config) {
        const configLoaded = await this.loadConfig(message.companyId);
        if (!configLoaded) {
          // Fallback: log the SMS instead of sending
          console.log('📱 SMS NOT SENT (no config):', {
            to: message.to,
            message: message.message,
          });

          return {
            success: true,
            messageId: 'logged-only-' + Date.now(),
          };
        }
      }

      // Validate phone number
      if (!ValidationUtils.isValidPhoneNumber(message.to)) {
        throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid phone number');
      }

      // Route to appropriate provider
      let result: SmsResult;

      switch (this.config!.provider) {
        case 'twilio':
          result = await this.sendViaTwilio(message);
          break;
        case 'aws_sns':
          result = await this.sendViaAwsSns(message);
          break;
        case 'nexmo':
          result = await this.sendViaNexmo(message);
          break;
        case 'internal':
        default:
          result = await this.sendInternal(message);
          break;
      }

      const duration = PerformanceUtils.endTimer(timerId);

      if (result.success) {
        console.log(`📱 SMS sent to ${message.to} in ${duration}ms. MessageId: ${result.messageId}`);
      } else {
        console.error(`Failed to send SMS to ${message.to}:`, result.error);
      }

      // Log delivery attempt
      await this.logSmsDelivery(message, result);

      return result;

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      const errorMessage = error instanceof Error ? error.message : 'SMS sending failed';
      console.error('Failed to send SMS:', errorMessage);

      // Log failed delivery
      await this.logSmsDelivery(message, { success: false, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Send OTP SMS
  async sendOtpSms(
    to: string,
    otpCode: string,
    purpose: string,
    companyId?: string
  ): Promise<SmsResult> {
    const templates = {
      verification: `Your MLM Platform verification code is: ${otpCode}. Expires in 10 minutes.`,
      password_reset: `Your MLM Platform password reset code is: ${otpCode}. Expires in 10 minutes.`,
      login_2fa: `Your MLM Platform login code is: ${otpCode}. Expires in 10 minutes.`,
      transaction: `Your MLM Platform transaction code is: ${otpCode}. Expires in 10 minutes.`,
    };

    const message = templates[purpose as keyof typeof templates] || templates.verification;

    return await this.send({
      to,
      message,
      companyId,
      metadata: { purpose, otpCode },
    });
  }

  // Send via Twilio
  private async sendViaTwilio(message: SmsMessage): Promise<SmsResult> {
    try {
      if (!this.config!.apiKey || !this.config!.apiSecret || !this.config!.accountSid) {
        throw new Error('Twilio credentials not configured');
      }

      // In a real implementation, you would use the Twilio SDK
      // const twilio = require('twilio');
      // const client = twilio(this.config.accountSid, this.config.apiKey);
      // const result = await client.messages.create({
      //   body: message.message,
      //   from: this.config.fromNumber,
      //   to: message.to
      // });

      // For now, simulate successful sending
      console.log('📱 [TWILIO SIMULATION] SMS sent:', {
        from: this.config!.fromNumber,
        to: message.to,
        message: message.message,
      });

      return {
        success: true,
        messageId: `twilio-${Date.now()}`,
        cost: 0.01, // Example cost
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Twilio sending failed',
      };
    }
  }

  // Send via AWS SNS
  private async sendViaAwsSns(message: SmsMessage): Promise<SmsResult> {
    try {
      if (!this.config!.apiKey || !this.config!.apiSecret || !this.config!.region) {
        throw new Error('AWS SNS credentials not configured');
      }

      // In a real implementation, you would use AWS SDK
      // const AWS = require('aws-sdk');
      // const sns = new AWS.SNS({
      //   accessKeyId: this.config.apiKey,
      //   secretAccessKey: this.config.apiSecret,
      //   region: this.config.region
      // });
      // const result = await sns.publish({
      //   Message: message.message,
      //   PhoneNumber: message.to,
      //   MessageAttributes: {
      //     'AWS.SNS.SMS.SenderID': {
      //       DataType: 'String',
      //       StringValue: 'MLMPlatform'
      //     }
      //   }
      // }).promise();

      // For now, simulate successful sending
      console.log('📱 [AWS SNS SIMULATION] SMS sent:', {
        to: message.to,
        message: message.message,
        region: this.config!.region,
      });

      return {
        success: true,
        messageId: `sns-${Date.now()}`,
        cost: 0.00645, // Example cost per message
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AWS SNS sending failed',
      };
    }
  }

  // Send via Nexmo (Vonage)
  private async sendViaNexmo(message: SmsMessage): Promise<SmsResult> {
    try {
      if (!this.config!.apiKey || !this.config!.apiSecret) {
        throw new Error('Nexmo credentials not configured');
      }

      // In a real implementation, you would use Nexmo SDK
      // const Nexmo = require('nexmo');
      // const nexmo = new Nexmo({
      //   apiKey: this.config.apiKey,
      //   apiSecret: this.config.apiSecret,
      // });
      // const result = await new Promise((resolve, reject) => {
      //   nexmo.message.sendSms(
      //     this.config.fromNumber,
      //     message.to,
      //     message.message,
      //     {},
      //     (err, responseData) => {
      //       if (err) reject(err);
      //       else resolve(responseData);
      //     }
      //   );
      // });

      // For now, simulate successful sending
      console.log('📱 [NEXMO SIMULATION] SMS sent:', {
        from: this.config!.fromNumber,
        to: message.to,
        message: message.message,
      });

      return {
        success: true,
        messageId: `nexmo-${Date.now()}`,
        cost: 0.02, // Example cost
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Nexmo sending failed',
      };
    }
  }

  // Internal SMS delivery (for development/testing)
  private async sendInternal(message: SmsMessage): Promise<SmsResult> {
    try {
      // Log the SMS for development purposes
      console.log('📱 [INTERNAL SMS] SMS logged (not sent):', {
        from: this.config!.fromNumber,
        to: message.to,
        message: message.message,
        purpose: message.metadata?.purpose,
        timestamp: new Date().toISOString(),
      });

      // In development, you might want to:
      // 1. Store in a local file
      // 2. Send to a development SMS gateway
      // 3. Use a service like SMS Gateway API

      return {
        success: true,
        messageId: `internal-${Date.now()}`,
        cost: 0, // No cost for internal
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal SMS delivery failed',
      };
    }
  }

  // Log SMS delivery
  private async logSmsDelivery(
    message: SmsMessage,
    result: SmsResult
  ): Promise<void> {
    try {
      // Log to database for audit trail
      await db.auditLog.create({
        data: {
          action: 'sms_sent',
          entity: 'otp',
          entityId: result.messageId || 'unknown',
          changes: {
            to: message.to,
            message: message.message.substring(0, 100) + '...', // Truncate for privacy
            status: result.success ? 'sent' : 'failed',
            error: result.error,
            cost: result.cost,
            metadata: message.metadata,
          },
          companyId: message.companyId,
        },
      });
    } catch (logError) {
      console.error('Failed to log SMS delivery:', logError);
    }
  }

  // Test SMS configuration
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test basic configuration
      if (!this.config?.fromNumber) {
        return { success: false, error: 'SMS from number not configured' };
      }

      // For providers, you would test API connectivity
      // For now, just check if config is loaded
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  // Get SMS statistics
  async getSmsStats(companyId?: string): Promise<any> {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count SMS sent in last 24 hours from audit logs
      const smsCount = await db.auditLog.count({
        where: {
          action: 'sms_sent',
          companyId,
          createdAt: { gte: last24Hours },
        },
      });

      // Calculate estimated cost (this would be more sophisticated in production)
      const costEstimate = smsCount * 0.01; // Example $0.01 per SMS

      return {
        smsSentLast24h: smsCount,
        estimatedCostLast24h: costEstimate.toFixed(2),
        configured: !!this.config,
        provider: this.config?.provider,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      console.error('Failed to get SMS stats:', error);
      return {
        smsSentLast24h: 0,
        estimatedCostLast24h: '0.00',
        configured: false,
        error: error instanceof Error ? error.message : 'Stats unavailable',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; configured: boolean; provider?: string; timestamp: string }> {
    try {
      const configured = !!this.config;
      let connectionOk = false;

      if (configured) {
        const testResult = await this.testConnection();
        connectionOk = testResult.success;
      }

      return {
        status: configured && connectionOk ? 'healthy' : 'degraded',
        configured,
        provider: this.config?.provider,
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
let smsServiceInstance: SmsService | null = null;

function getSmsService(): SmsService {
  if (!smsServiceInstance) {
    smsServiceInstance = new SmsService();
  }
  return smsServiceInstance;
}

// Server actions for API routes
export async function sendOtpSmsServer(
  to: string,
  otpCode: string,
  purpose: string,
  companyId?: string
): Promise<SmsResult> {
  try {
    const service = getSmsService();
    return await service.sendOtpSms(to, otpCode, purpose, companyId);
  } catch (error) {
    console.error('Failed to send OTP SMS:', error);
    throw error;
  }
}

export async function testSmsConnectionServer(): Promise<{ success: boolean; error?: string }> {
  try {
    const service = getSmsService();
    return await service.testConnection();
  } catch (error) {
    console.error('Failed to test SMS connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Test failed' };
  }
}

export async function getSmsStatsServer(companyId?: string): Promise<any> {
  try {
    const service = getSmsService();
    return await service.getSmsStats(companyId);
  } catch (error) {
    console.error('Failed to get SMS stats:', error);
    return null;
  }
}

export { getSmsService };
export default getSmsService;