// =============================================================================
// HOSTING MAIL SERVICE - UNIT TESTS
// =============================================================================

import { HostingMailService, MailConfig } from '../lib/hosting-mail-service';

// Mock external dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('mailgun.js');
jest.mock('@aws-sdk/client-ses');
jest.mock('../src/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// Mock the entire rate-limiter module
jest.mock('../src/lib/rate-limiter', () => ({
  RateLimitStore: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(0),
    increment: jest.fn().mockResolvedValue(1),
  }))
}));

// Get a reference to the mocked constructor
const { RateLimitStore } = require('../src/lib/rate-limiter');

describe('HostingMailService', () => {
  let service: HostingMailService;
  let mockConfig: MailConfig;

  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();

    // Reset RateLimitStore to its default mock implementation
    RateLimitStore.mockImplementation(() => ({
      get: jest.fn().mockResolvedValue(0),
      increment: jest.fn().mockResolvedValue(1),
    }));

    mockConfig = {
      fromEmail: 'test@example.com',
      fromName: 'Test Service',
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'user',
      smtpPass: 'pass',
      retry: { maxAttempts: 3, backoffMs: 1 } // Fast backoff for tests
    };
    service = new HostingMailService(mockConfig);
  });

  describe('Email Sending', () => {
    it('should send a basic email via SMTP', async () => {
      const nodemailer = require('nodemailer');
      const mockTransporter = { sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-id' }) };
      nodemailer.createTransport.mockReturnValue(mockTransporter);
      const result = await service.sendEmail({ to: 'test@example.com', subject: 'Test', message: 'Hello' });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('smtp-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should send an email via SendGrid', async () => {
      mockConfig.provider = 'sendgrid';
      mockConfig.providerConfig = { sendgrid: { apiKey: 'test-key' } };
      service = new HostingMailService(mockConfig);
      const sendgrid = require('@sendgrid/mail');
      sendgrid.send.mockResolvedValue([{ headers: { 'x-message-id': 'sg-id' } }]);
      const result = await service.sendEmail({ to: 'test@example.com', subject: 'Test', message: 'Hello' });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sg-id');
    });

    it('should retry sending on failure', async () => {
      const nodemailer = require('nodemailer');
      const mockTransporter = { 
        sendMail: jest.fn()
          .mockRejectedValueOnce(new Error('SMTP Error'))
          .mockResolvedValueOnce({ messageId: 'retry-id' })
      };
      nodemailer.createTransport.mockReturnValue(mockTransporter);
      const result = await service.sendEmail({ to: 'test@example.com', subject: 'Test', message: 'Hello' });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('retry-id');
      expect(result.attempts).toBe(2);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should fail on invalid email address', async () => {
      const result = await service.sendEmail({ to: 'invalid', subject: 'Test', message: 'Hello' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should fail if rate limit is exceeded', async () => {
      RateLimitStore.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(101),
        increment: jest.fn(),
      }));
      service = new HostingMailService(mockConfig);
      const result = await service.sendEmail({ to: 'test@example.com', subject: 'Test', message: 'Hello' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Hourly email limit exceeded');
    });

    it('should fail after all retry attempts are exhausted', async () => {
      const nodemailer = require('nodemailer');
      const mockTransporter = { 
        sendMail: jest.fn().mockRejectedValue(new Error('Persistent SMTP Error'))
      };
      nodemailer.createTransport.mockReturnValue(mockTransporter);
      const result = await service.sendEmail({ to: 'test@example.com', subject: 'Test', message: 'Hello' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent SMTP Error');
      expect(result.attempts).toBe(3);
    });
  });

  describe('Templating', () => {
    it('should send a templated email', async () => {
      service.registerTemplate({ name: 'welcome', subject: 'Welcome {{name}}!', html: 'Hello {{name}}' });
      const nodemailer = require('nodemailer');
      const mockTransporter = { sendMail: jest.fn().mockResolvedValue({ messageId: 'template-id' }) };
      nodemailer.createTransport.mockReturnValue(mockTransporter);
      const result = await service.sendTemplatedEmail('test@example.com', 'welcome', { name: 'John' });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('template-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Welcome John!' }));
    });

    it('should fail if template is not found', async () => {
      const result = await service.sendTemplatedEmail('test@example.com', 'nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Template 'nonexistent' not found");
    });
  });
});
