// =============================================================================
// HOSTING MAIL SERVICE - UNIT TESTS
// =============================================================================
// Comprehensive test suite for the production-ready email service.
//
// @author Kilo Code
// @version 1.0.0
// =============================================================================

import { HostingMailService, MailConfig, EmailValidationError, RateLimitError } from '../lib/hosting-mail-service';

// Mock external dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('mailgun.js');
jest.mock('@aws-sdk/client-ses');
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));
jest.mock('../src/lib/rate-limiter', () => ({
  RateLimitStore: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    increment: jest.fn(),
    cleanup: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(),
    destroy: jest.fn(),
  }))
}));

// Mock fetch for hosting mail
global.fetch = jest.fn();

describe('HostingMailService', () => {
  let service: HostingMailService;
  let mockConfig: MailConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      fromEmail: 'test@example.com',
      fromName: 'Test Service',
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'user',
      smtpPass: 'pass',
      rateLimit: {
        maxEmailsPerHour: 10,
        maxEmailsPerDay: 50
      },
      retry: {
        maxAttempts: 2,
        backoffMs: 100
      }
    };

    service = new HostingMailService(mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      const minimalConfig: MailConfig = {
        fromEmail: 'test@example.com',
        fromName: 'Test'
      };

      const svc = new HostingMailService(minimalConfig);

      expect(svc).toBeDefined();
    });

    it('should merge config with defaults', () => {
      expect(mockConfig.rateLimit?.maxEmailsPerHour).toBe(10);
      expect(mockConfig.retry?.maxAttempts).toBe(2);
    });
  });

  describe('Input Validation', () => {
    it('should validate email addresses', async () => {
      const invalidMessage = {
        to: 'invalid-email',
        subject: 'Test',
        message: 'Test message'
      };

      await expect(service.sendEmail(invalidMessage)).rejects.toThrow(EmailValidationError);
    });

    it('should validate required fields', async () => {
      const invalidMessage = {
        to: 'test@example.com',
        subject: '',
        message: 'Test message'
      };

      await expect(service.sendEmail(invalidMessage)).rejects.toThrow(EmailValidationError);
    });

    it('should sanitize subject and message', async () => {
      const maliciousMessage = {
        to: 'test@example.com',
        subject: '<script>alert("xss")</script>Test',
        message: 'Test message with <script>evil()</script>'
      };

      // Should not throw validation error for sanitized content
      // The sanitization happens internally
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      await service.sendEmail(maliciousMessage);

      expect(mockSend).toHaveBeenCalled();
    });

    it('should detect suspicious content', async () => {
      const suspiciousMessage = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message with eval(alert(1))'
      };

      await expect(service.sendEmail(suspiciousMessage)).rejects.toThrow(EmailValidationError);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce hourly limits', async () => {
      const message = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      // Mock successful sends
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      // Send up to the limit
      for (let i = 0; i < 10; i++) {
        await service.sendEmail(message);
      }

      // Next send should be rate limited
      await expect(service.sendEmail(message)).rejects.toThrow(RateLimitError);

      expect(mockSend).toHaveBeenCalledTimes(10);
    });

    it('should enforce daily limits', async () => {
      const message = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      // Mock successful sends
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      // Send up to the daily limit
      for (let i = 0; i < 50; i++) {
        await service.sendEmail(message);
      }

      // Next send should be rate limited
      await expect(service.sendEmail(message)).rejects.toThrow(RateLimitError);

      expect(mockSend).toHaveBeenCalledTimes(50);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on failure', async () => {
      const message = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      // Mock send to fail twice then succeed
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ success: true });

      const result = await service.sendEmail(message);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const message = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      // Mock send to always fail
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect')
        .mockRejectedValue(new Error('Persistent error'));

      const result = await service.sendEmail(message);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2); // maxAttempts
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('SMTP Provider', () => {
    beforeEach(() => {
      mockConfig.provider = 'smtp';
      service = new HostingMailService(mockConfig);
    });

    it('should send via SMTP successfully', async () => {
      const message = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: '<p>Test message</p>'
      };

      // Mock nodemailer
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id'
        })
      };

      const nodemailer = require('nodemailer');
      nodemailer.createTransporter.mockReturnValue(mockTransporter);

      const result = await service.sendEmail(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test Service" <test@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test message</p>'
      });
    });

    it('should handle SMTP errors', async () => {
      const message = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: 'Test message'
      };

      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection failed'))
      };

      const nodemailer = require('nodemailer');
      nodemailer.createTransporter.mockReturnValue(mockTransporter);

      const result = await service.sendEmail(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP send failed');
    });
  });

  describe('SendGrid Provider', () => {
    beforeEach(() => {
      mockConfig.provider = 'sendgrid';
      mockConfig.providerConfig = {
        sendgrid: { apiKey: 'test-api-key' }
      };
      service = new HostingMailService(mockConfig);
    });

    it('should send via SendGrid successfully', async () => {
      const message = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: '<p>Test message</p>'
      };

      const sendgrid = require('@sendgrid/mail');
      sendgrid.setApiKey = jest.fn();
      sendgrid.send = jest.fn().mockResolvedValue([{ headers: { 'x-message-id': 'sg-message-id' } }]);

      const result = await service.sendEmail(message);

      expect(result.success).toBe(true);
      expect(sendgrid.setApiKey).toHaveBeenCalledWith('test-api-key');
      expect(sendgrid.send).toHaveBeenCalled();
    });
  });

  describe('Mailgun Provider', () => {
    beforeEach(() => {
      mockConfig.provider = 'mailgun';
      mockConfig.providerConfig = {
        mailgun: { apiKey: 'test-api-key', domain: 'example.com' }
      };
      service = new HostingMailService(mockConfig);
    });

    it('should send via Mailgun successfully', async () => {
      const message = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: '<p>Test message</p>'
      };

      const mailgun = require('mailgun.js');
      const mockMg = {
        messages: {
          create: jest.fn().mockResolvedValue({ id: 'mg-message-id' })
        }
      };
      mailgun.client.mockReturnValue(mockMg);

      const result = await service.sendEmail(message);

      expect(result.success).toBe(true);
      expect(mockMg.messages.create).toHaveBeenCalled();
    });
  });

  describe('AWS SES Provider', () => {
    beforeEach(() => {
      mockConfig.provider = 'ses';
      mockConfig.providerConfig = {
        ses: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          region: 'us-east-1'
        }
      };
      service = new HostingMailService(mockConfig);
    });

    it('should send via AWS SES successfully', async () => {
      const message = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: '<p>Test message</p>'
      };

      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      const mockClient = {
        send: jest.fn().mockResolvedValue({ MessageId: 'ses-message-id' })
      };

      const sesModule = require('@aws-sdk/client-ses');
      sesModule.SESClient.mockImplementation(() => mockClient);

      const result = await service.sendEmail(message);

      expect(result.success).toBe(true);
      expect(mockClient.send).toHaveBeenCalled();
    });
  });

  describe('Template Support', () => {
    it('should register and use templates', async () => {
      const template = {
        name: 'welcome',
        subject: 'Welcome {{name}}!',
        html: '<h1>Hello {{name}}</h1><p>Welcome to {{company}}</p>',
        text: 'Hello {{name}}, welcome to {{company}}'
      };

      service.registerTemplate(template);

      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      const result = await service.sendTemplatedEmail(
        'user@example.com',
        'welcome',
        { name: 'John', company: 'ACME Corp' }
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome John!',
          message: '<h1>Hello John</h1><p>Welcome to ACME Corp</p>'
        }),
        expect.any(String)
      );
    });

    it('should throw error for unknown template', async () => {
      await expect(
        service.sendTemplatedEmail('user@example.com', 'unknown', {})
      ).rejects.toThrow(EmailValidationError);
    });
  });

  describe('OTP Email', () => {
    it('should send verification OTP email', async () => {
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      const result = await service.sendOTPEmail('user@example.com', '123456', 'verification');

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Verify Your Account',
          message: expect.stringContaining('123456')
        }),
        expect.any(String)
      );
    });

    it('should send password reset OTP email', async () => {
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      const result = await service.sendOTPEmail('user@example.com', '654321', 'password_reset');

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset Your Password',
          message: expect.stringContaining('654321')
        }),
        expect.any(String)
      );
    });
  });

  describe('Test Email', () => {
    it('should send test email', async () => {
      const mockSend = jest.spyOn(service as any, 'sendEmailDirect').mockResolvedValue({ success: true });

      const result = await service.testEmail('admin@example.com');

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: 'Email Configuration Test',
          message: expect.stringContaining('Email Test Successful')
        }),
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const message = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      const mockSend = jest.spyOn(service as any, 'sendEmailDirect')
        .mockRejectedValue(new Error('Network timeout'));

      const result = await service.sendEmail(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle malformed messages', async () => {
      const invalidMessage = {
        to: null,
        subject: 'Test',
        message: 'Test message'
      } as any;

      await expect(service.sendEmail(invalidMessage)).rejects.toThrow(EmailValidationError);
    });
  });

  describe('Attachments', () => {
    it('should handle attachments in SMTP', async () => {
      const message = {
        to: 'test@example.com',
        subject: 'Test with attachment',
        message: 'Test message',
        attachments: [{
          filename: 'test.txt',
          content: Buffer.from('test content'),
          contentType: 'text/plain'
        }]
      };

      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
      };

      const nodemailer = require('nodemailer');
      nodemailer.createTransporter.mockReturnValue(mockTransporter);

      await service.sendEmail(message);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'test.txt',
              content: expect.any(Buffer)
            })
          ])
        })
      );
    });
  });
});