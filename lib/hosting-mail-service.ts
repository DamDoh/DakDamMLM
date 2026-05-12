// =============================================================================
// HOSTING MAIL SERVICE - Production-Ready Email Delivery
// =============================================================================
// Comprehensive email sending capabilities for traditional web hosting providers
// and popular email services with full TypeScript support.
//
// Features:
// - SMTP configuration and authentication
// - Template support with variable substitution
// - Error handling and logging
// - Rate limiting and security measures
// - Retry mechanisms with exponential backoff
// - Integration with SendGrid, Mailgun, AWS SES
// - Input validation and sanitization
//
// @author Kilo Code
// @version 2.0.0
// @since 2025
//
// USAGE EXAMPLES:
//
// Basic SMTP setup:
// ```typescript
// const mailService = new HostingMailService({
//   fromEmail: 'noreply@yourdomain.com',
//   fromName: 'Your App',
//   provider: 'smtp',
//   smtpHost: 'mail.yourdomain.com',
//   smtpPort: 587,
//   smtpUser: 'your-smtp-user',
//   smtpPass: 'your-smtp-password'
// });
//
// const result = await mailService.sendEmail({
//   to: 'user@example.com',
//   subject: 'Welcome!',
//   message: '<h1>Hello World</h1>'
// });
// ```
//
// SendGrid integration:
// ```typescript
// const mailService = new HostingMailService({
//   fromEmail: 'noreply@yourdomain.com',
//   fromName: 'Your App',
//   provider: 'sendgrid',
//   providerConfig: {
//     sendgrid: { apiKey: process.env.SENDGRID_API_KEY }
//   }
// });
// ```
//
// Template usage:
// ```typescript
// mailService.registerTemplate({
//   name: 'welcome',
//   subject: 'Welcome {{name}}!',
//   html: '<h1>Hello {{name}}</h1><p>Welcome to {{company}}</p>'
// });
//
// await mailService.sendTemplatedEmail('user@example.com', 'welcome', {
//   name: 'John',
//   company: 'ACME Corp'
// });
// ```
//
// ENVIRONMENT VARIABLES:
// - HOSTING_MAIL_ENDPOINT: HTTP endpoint for hosting mail fallback
// - HOSTING_MAIL_TOKEN: Auth token for hosting mail endpoint
// - SENDGRID_API_KEY: SendGrid API key
// - MAILGUN_API_KEY: Mailgun API key
// - MAILGUN_DOMAIN: Mailgun domain
// - AWS_ACCESS_KEY_ID: AWS access key
// - AWS_SECRET_ACCESS_KEY: AWS secret key
// - AWS_REGION: AWS region
// =============================================================================

import { logger } from '../src/lib/logger';
import { sanitizeEmail, sanitizeString, isSuspicious } from '../src/lib/input-sanitization';
import { RateLimitStore } from '../api-gateway/src/lib/rate-limiter';

export interface MailConfig {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  rateLimit?: {
    maxEmailsPerHour?: number;
    maxEmailsPerDay?: number;
  };
  retry?: {
    maxAttempts?: number;
    backoffMs?: number;
  };
  provider?: 'smtp' | 'sendgrid' | 'mailgun' | 'ses' | 'hosting';
  providerConfig?: {
    sendgrid?: { apiKey: string };
    mailgun?: { apiKey: string; domain: string };
    ses?: { accessKeyId: string; secretAccessKey: string; region: string };
  };
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  message: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts?: number;
}

export class EmailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailValidationError';
  }
}

export class EmailSendError extends Error {
  constructor(message: string, public attempts?: number) {
    super(message);
    this.name = 'EmailSendError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Production-ready email service for hosting providers and popular email services.
 *
 * Supports multiple email providers with comprehensive error handling,
 * rate limiting, retry mechanisms, and security features.
 *
 * @example
 * ```typescript
 * const mailService = new HostingMailService({
 *   fromEmail: 'noreply@yourdomain.com',
 *   fromName: 'Your App',
 *   provider: 'smtp',
 *   smtpHost: 'mail.yourdomain.com',
 *   smtpPort: 587,
 *   smtpUser: 'user',
 *   smtpPass: 'password'
 * });
 *
 * const result = await mailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   message: '<h1>Welcome!</h1>'
 * });
 * ```
 */
export class HostingMailService {
  private config: MailConfig;
  private rateLimitStore: RateLimitStore;
  private emailCount: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Creates a new HostingMailService instance.
   *
   * @param config - Email service configuration
   * @param rateLimitStore - Optional custom rate limit store (for testing)
   */
  constructor(config: MailConfig, rateLimitStore?: RateLimitStore) {
    this.config = {
      rateLimit: { maxEmailsPerHour: 100, maxEmailsPerDay: 1000 },
      retry: { maxAttempts: 3, backoffMs: 1000 },
      smtpSecure: false,
      ...config
    };
    this.rateLimitStore = rateLimitStore || new RateLimitStore();
  }

  /**
   * Sends an email using the configured provider.
   *
   * Performs input validation, rate limiting, and retry logic automatically.
   *
   * @param message - Email message to send
   * @returns Promise resolving to send result with success status and metadata
   * @throws {EmailValidationError} If message validation fails
   * @throws {RateLimitError} If rate limits are exceeded
   *
   * @example
   * ```typescript
   * const result = await mailService.sendEmail({
   *   to: 'user@example.com',
   *   subject: 'Welcome!',
   *   message: '<h1>Hello World</h1>',
   *   attachments: [{
   *     filename: 'welcome.pdf',
   *     content: buffer,
   *     contentType: 'application/pdf'
   *   }]
   * });
   *
   * if (result.success) {
   *   console.log('Email sent with ID:', result.messageId);
   * }
   * ```
   */
  async sendEmail(message: MailMessage): Promise<SendResult> {
    const startTime = Date.now();
    logger.info('Starting email send process', { to: message.to, subject: message.subject });

    try {
      // Validate and sanitize input
      const validationResult = this.validateMessage(message);
      if (!validationResult.valid) {
        throw new EmailValidationError(validationResult.error || 'Invalid email message');
      }

      // Check rate limits
      await this.checkRateLimits(message);

      // Build email headers
      const mailHeaders = this.buildHeaders(message.headers || {});

      // Send with retry logic
      const result = await this.sendWithRetry(message, mailHeaders);

      const duration = Date.now() - startTime;
      logger.info('Email send completed', {
        success: result.success,
        messageId: result.messageId,
        attempts: result.attempts,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Email send failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to,
        subject: message.subject,
        duration
      });

      if (error instanceof EmailValidationError || error instanceof RateLimitError) {
        return { success: false, error: error.message };
      }

      return { success: false, error: 'Email sending failed', attempts: this.config.retry?.maxAttempts || 3 };
    }
  }

  // Validate email message
  private validateMessage(message: MailMessage): { valid: boolean; error?: string } {
    // Validate recipients
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    for (const recipient of recipients) {
      const sanitized = sanitizeEmail(recipient);
      if (!sanitized) {
        return { valid: false, error: `Invalid email address: ${recipient}` };
      }
    }

    // Validate subject
    if (!message.subject || message.subject.trim().length === 0) {
      return { valid: false, error: 'Subject is required' };
    }

    const sanitizedSubject = sanitizeString(message.subject, { maxLength: 200 });
    if (sanitizedSubject !== message.subject.trim()) {
      return { valid: false, error: 'Subject contains invalid characters' };
    }

    // Validate message body
    if (!message.message || message.message.trim().length === 0) {
      return { valid: false, error: 'Message body is required' };
    }

    // Check for suspicious content
    if (isSuspicious(message.subject) || isSuspicious(message.message)) {
      logger.security('Suspicious email content detected', undefined, {
        subject: message.subject,
        bodyLength: message.message.length
      });
      return { valid: false, error: 'Email content contains suspicious patterns' };
    }

    // Validate attachments if present
    if (message.attachments) {
      for (const attachment of message.attachments) {
        if (!attachment.filename || !attachment.content) {
          return { valid: false, error: 'Invalid attachment data' };
        }
        if (attachment.filename.length > 255) {
          return { valid: false, error: 'Attachment filename too long' };
        }
      }
    }

    return { valid: true };
  }

  // Check rate limits
  private async checkRateLimits(message: MailMessage): Promise<void> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const now = Date.now();

    // Check per-hour limit
    const hourlyKey = `email_hour_${this.config.fromEmail}`;
    const hourlyEntry = this.emailCount.get(hourlyKey);
    const hourMs = 60 * 60 * 1000;

    if (hourlyEntry && now < hourlyEntry.resetTime) {
      if (hourlyEntry.count >= (this.config.rateLimit?.maxEmailsPerHour || 100)) {
        throw new RateLimitError('Hourly email limit exceeded');
      }
    } else {
      this.emailCount.set(hourlyKey, { count: 0, resetTime: now + hourMs });
    }

    // Check per-day limit
    const dailyKey = `email_day_${this.config.fromEmail}`;
    const dailyEntry = this.emailCount.get(dailyKey);
    const dayMs = 24 * 60 * 60 * 1000;

    if (dailyEntry && now < dailyEntry.resetTime) {
      if (dailyEntry.count >= (this.config.rateLimit?.maxEmailsPerDay || 1000)) {
        throw new RateLimitError('Daily email limit exceeded');
      }
    } else {
      this.emailCount.set(dailyKey, { count: 0, resetTime: now + dayMs });
    }

    // Update counters
    const hourly = this.emailCount.get(hourlyKey)!;
    const daily = this.emailCount.get(dailyKey)!;
    hourly.count += recipients.length;
    daily.count += recipients.length;

    this.emailCount.set(hourlyKey, hourly);
    this.emailCount.set(dailyKey, daily);
  }

  // Send with retry logic
  private async sendWithRetry(message: MailMessage, headers: string): Promise<SendResult> {
    const maxAttempts = this.config.retry?.maxAttempts || 3;
    const backoffMs = this.config.retry?.backoffMs || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Email send attempt ${attempt}/${maxAttempts}`, { to: message.to });

        const result = await this.sendEmailDirect(message, headers);

        if (result.success) {
          return { ...result, attempts: attempt };
        }

        // If this was the last attempt, return the failure
        if (attempt === maxAttempts) {
          return { ...result, attempts: attempt };
        }

        // Wait before retry
        const delay = backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        logger.warn(`Email send attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt,
          maxAttempts
        });

        if (attempt === maxAttempts) {
          throw error;
        }

        // Wait before retry
        const delay = backoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success: false, error: 'All retry attempts failed', attempts: maxAttempts };
  }

  // Build email headers
  private buildHeaders(additionalHeaders: Record<string, string> = {}): string {
    const headers: Record<string, string> = {
      'From': `${this.config.fromName} <${this.config.fromEmail}>`,
      'Reply-To': this.config.replyTo || this.config.fromEmail,
      'Content-Type': 'text/html; charset=UTF-8',
      'X-Mailer': 'MLM Platform Hosting Mail Service',
      ...additionalHeaders
    };

    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');
  }

  // Send email directly (production implementation)
  private async sendEmailDirect(message: MailMessage, headers: string): Promise<SendResult> {
    try {
      const provider = this.config.provider || 'smtp';

      switch (provider) {
        case 'sendgrid':
          return await this.sendViaSendGrid(message);
        case 'mailgun':
          return await this.sendViaMailgun(message);
        case 'ses':
          return await this.sendViaSES(message);
        case 'smtp':
          if (this.config.smtpHost && this.config.smtpUser && this.config.smtpPass) {
            return await this.sendViaSMTP(message, headers);
          }
          // Fall through to hosting
        case 'hosting':
        default:
          return await this.sendViaHostingMail(message, headers);
      }

    } catch (error) {
      logger.error('Direct email sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.config.provider
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send via SMTP (for hosting providers that support SMTP relay)
  private async sendViaSMTP(message: MailMessage, headers: string): Promise<SendResult> {
    try {
      // Dynamic import to avoid issues if nodemailer is not installed
      const nodemailer = await import('nodemailer');

      const transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort || 587,
        secure: this.config.smtpSecure || false,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPass,
        },
        // Additional security options
        tls: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        }
      });

      const mailOptions: any = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: message.to,
        subject: message.subject,
        html: message.message,
      };

      // Add attachments if present
      if (message.attachments && message.attachments.length > 0) {
        mailOptions.attachments = message.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }));
      }

      const info = await transporter.sendMail(mailOptions);
      logger.info('Email sent via SMTP', { messageId: info.messageId, to: message.to });

      return { success: true, messageId: info.messageId };

    } catch (error) {
      logger.error('SMTP sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to
      });
      throw new EmailSendError(`SMTP send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Send via hosting provider's mail function (PHP-style)
  private async sendViaHostingMail(message: MailMessage, headers: string): Promise<SendResult> {
    // In a real hosting environment, this would call PHP mail() function
    // Since we're in Node.js, we'll implement this as an HTTP call to a PHP endpoint
    // or use a third-party service

    try {
      // Check if we have a hosting mail endpoint configured
      const hostingEndpoint = process.env.HOSTING_MAIL_ENDPOINT;

      if (hostingEndpoint) {
        // Send via HTTP to PHP script
        const response = await fetch(hostingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.HOSTING_MAIL_TOKEN || ''}`
          },
          body: JSON.stringify({
            to: message.to,
            subject: message.subject,
            body: message.message,
            headers,
            from: this.config.fromEmail,
            fromName: this.config.fromName,
            attachments: message.attachments
          })
        });

        if (response.ok) {
          const result = await response.json();
          return { success: true, messageId: result.messageId };
        } else {
          throw new Error(`Hosting mail HTTP error: ${response.status}`);
        }
      }

      // Fallback: Use a third-party service or throw error
      logger.warn('No hosting mail configuration found, falling back to error');
      throw new EmailSendError('Hosting mail not configured. Please configure SMTP or hosting endpoint.');

    } catch (error) {
      logger.error('Hosting mail sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new EmailSendError(`Hosting mail failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Send via SendGrid
  private async sendViaSendGrid(message: MailMessage): Promise<SendResult> {
    try {
      const apiKey = this.config.providerConfig?.sendgrid?.apiKey;
      if (!apiKey) {
        throw new EmailSendError('SendGrid API key not configured');
      }

      const sendgrid = await import('@sendgrid/mail');
      sendgrid.default.setApiKey(apiKey);

      const msg: any = {
        to: message.to,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        subject: message.subject,
        html: message.message,
      };

      if (this.config.replyTo) {
        msg.replyTo = this.config.replyTo;
      }

      if (message.attachments && message.attachments.length > 0) {
        msg.attachments = message.attachments.map(att => ({
          content: att.content.toString('base64'),
          filename: att.filename,
          type: att.contentType || 'application/octet-stream',
          disposition: 'attachment'
        }));
      }

      const result = await sendgrid.default.send(msg);
      return { success: true, messageId: result[0]?.headers?.['x-message-id'] };

    } catch (error) {
      logger.error('SendGrid sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new EmailSendError(`SendGrid send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Send via Mailgun
  private async sendViaMailgun(message: MailMessage): Promise<SendResult> {
    try {
      const config = this.config.providerConfig?.mailgun;
      if (!config?.apiKey || !config?.domain) {
        throw new EmailSendError('Mailgun API key and domain not configured');
      }

      const Mailgun = (await import('mailgun.js')).default;
      const mg = (Mailgun as any).client({ username: 'api', key: config.apiKey });

      const data: any = {
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.message,
      };

      if (this.config.replyTo) {
        data['h:Reply-To'] = this.config.replyTo;
      }

      if (message.attachments && message.attachments.length > 0) {
        // Mailgun handles attachments differently
        message.attachments.forEach((att, index) => {
          data[`attachment[${index}]`] = {
            data: att.content,
            filename: att.filename,
            contentType: att.contentType || 'application/octet-stream'
          };
        });
      }

      const result = await mg.messages.create(config.domain, data);
      return { success: true, messageId: result.id };

    } catch (error) {
      logger.error('Mailgun sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new EmailSendError(`Mailgun send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Send via AWS SES
  private async sendViaSES(message: MailMessage): Promise<SendResult> {
    try {
      const config = this.config.providerConfig?.ses;
      if (!config?.accessKeyId || !config?.secretAccessKey || !config?.region) {
        throw new EmailSendError('AWS SES credentials not configured');
      }

      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      const sesClient = new SESClient({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      const params = {
        Source: `${this.config.fromName} <${this.config.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
        },
        Message: {
          Subject: {
            Data: message.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: message.message,
              Charset: 'UTF-8',
            },
          },
        },
      };

      const command = new SendEmailCommand(params);
      const result = await sesClient.send(command);

      return { success: true, messageId: result.MessageId };

    } catch (error) {
      logger.error('AWS SES sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new EmailSendError(`AWS SES send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sends an OTP (One-Time Password) email for verification purposes.
   *
   * Uses a pre-built HTML template with security warnings and expiry information.
   *
   * @param to - Recipient email address
   * @param otpCode - The OTP code to send
   * @param purpose - Purpose of the OTP (affects email content)
   * @returns Promise resolving to send result
   *
   * @example
   * ```typescript
   * const result = await mailService.sendOTPEmail(
   *   'user@example.com',
   *   '123456',
   *   'verification'
   * );
   * ```
   */
  async sendOTPEmail(
    to: string,
    otpCode: string,
    purpose: 'verification' | 'password_reset' | 'login_2fa'
  ): Promise<SendResult> {
    const subject = this.getOTPSubject(purpose);
    const message = this.getOTPMessage(otpCode, purpose);

    return await this.sendEmail({
      to,
      subject,
      message,
    });
  }

  // Get OTP email subject
  private getOTPSubject(purpose: string): string {
    const subjects = {
      verification: 'Verify Your Account',
      password_reset: 'Reset Your Password',
      login_2fa: 'Login Verification Code'
    };
    return subjects[purpose as keyof typeof subjects] || 'Verification Code';
  }

  // Template management
  private templates: Map<string, EmailTemplate> = new Map();

  /**
   * Registers an email template for later use.
   *
   * @param template - Email template configuration
   *
   * @example
   * ```typescript
   * mailService.registerTemplate({
   *   name: 'welcome',
   *   subject: 'Welcome {{name}}!',
   *   html: '<h1>Hello {{name}}</h1><p>Welcome to {{company}}</p>',
   *   text: 'Hello {{name}}, welcome to {{company}}'
   * });
   * ```
   */
  registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.name, template);
    logger.info('Email template registered', { templateName: template.name });
  }

  /**
   * Sends an email using a registered template with variable substitution.
   *
   * @param to - Recipient email address(es)
   * @param templateName - Name of the registered template
   * @param variables - Variables to substitute in the template
   * @param additionalHeaders - Optional additional email headers
   * @returns Promise resolving to send result
   * @throws {EmailValidationError} If template doesn't exist
   *
   * @example
   * ```typescript
   * await mailService.sendTemplatedEmail(
   *   'user@example.com',
   *   'welcome',
   *   { name: 'John', company: 'ACME Corp' }
   * );
   * ```
   */
  async sendTemplatedEmail(
    to: string | string[],
    templateName: string,
    variables: Record<string, any>,
    additionalHeaders?: Record<string, string>
  ): Promise<SendResult> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new EmailValidationError(`Template '${templateName}' not found`);
    }

    // Render template
    const subject = this.renderTemplate(template.subject, variables);
    const html = this.renderTemplate(template.html, variables);
    const text = template.text ? this.renderTemplate(template.text, variables) : undefined;

    return await this.sendEmail({
      to,
      subject,
      message: html,
      headers: {
        ...additionalHeaders,
        ...(text && { 'Content-Type': 'multipart/alternative' })
      }
    });
  }

  // Render template with variables
  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  // Get OTP email message
  private getOTPMessage(code: string, purpose: string): string {
    const expiryMinutes = 10; // OTP expiry time

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Code</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .code {
          font-size: 32px;
          font-weight: bold;
          color: #007bff;
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
          border: 2px dashed #007bff;
          letter-spacing: 3px;
        }
        .footer {
          font-size: 12px;
          color: #666;
          margin-top: 30px;
          text-align: center;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        .warning {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Verification Code</h1>
          <p>Please use the code below to complete your ${purpose.replace('_', ' ')}</p>
        </div>

        <div class="code">${code}</div>

        <div class="warning">
          <strong>Important:</strong> This code will expire in ${expiryMinutes} minutes.
          Do not share this code with anyone.
        </div>

        <p>If you didn't request this code, please ignore this email.</p>

        <div class="footer">
          <p>This is an automated message from your MLM Platform.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Sends a test email to verify configuration.
   *
   * Useful for testing email setup without sending actual application emails.
   *
   * @param to - Email address to send test to
   * @returns Promise resolving to send result
   *
   * @example
   * ```typescript
   * const result = await mailService.testEmail('admin@example.com');
   * if (result.success) {
   *   console.log('Email configuration is working!');
   * }
   * ```
   */
  async testEmail(to: string): Promise<SendResult> {
    const testSubject = 'Email Configuration Test';
    const testMessage = `
    <h2>Email Test Successful!</h2>
    <p>If you received this email, your hosting mail configuration is working correctly.</p>
    <p>Test sent at: ${new Date().toISOString()}</p>
    <p>Configuration: ${this.config.smtpHost ? 'SMTP' : 'Hosting Mail'}</p>
    `;

    return await this.sendEmail({
      to,
      subject: testSubject,
      message: testMessage,
    });
  }
}

// =============================================================================
// FACTORY FUNCTIONS AND PRESETS
// =============================================================================

/**
 * Factory function to create a HostingMailService instance.
 *
 * @param config - Email service configuration
 * @returns Configured HostingMailService instance
 *
 * @example
 * ```typescript
 * const mailService = createHostingMailService({
 *   fromEmail: 'noreply@yourdomain.com',
 *   fromName: 'Your App',
 *   provider: 'sendgrid',
 *   providerConfig: {
 *     sendgrid: { apiKey: process.env.SENDGRID_API_KEY }
 *   }
 * });
 * ```
 */
export function createHostingMailService(config: MailConfig): HostingMailService {
  return new HostingMailService(config);
}

/**
 * Helper function to create mail service for common providers.
 *
 * @param provider - Provider preset name
 * @param customConfig - Custom configuration to override defaults
 * @returns Configured HostingMailService instance
 *
 * @example
 * ```typescript
 * const mailService = getHostingMailService('sendgrid', {
 *   fromEmail: 'noreply@yourdomain.com',
 *   providerConfig: {
 *     sendgrid: { apiKey: process.env.SENDGRID_API_KEY }
 *   }
 * });
 * ```
 */
// =============================================================================
// PROVIDER PRESETS
// =============================================================================

/**
 * Pre-configured settings for common hosting providers and email services.
 *
 * These presets provide sensible defaults that can be customized as needed.
 * Environment variables should be used for sensitive configuration like API keys.
 */
export const HOSTING_MAIL_CONFIGS = {
  // Traditional hosting providers with SMTP
  bluehost: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'smtp' as const,
    smtpHost: 'mail.yourdomain.com',
    smtpPort: 587,
    smtpSecure: false,
  },

  hostgator: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'smtp' as const,
    smtpHost: 'mail.yourdomain.com',
    smtpPort: 587,
    smtpSecure: false,
  },

  godaddy: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'smtp' as const,
    smtpHost: 'smtpout.secureserver.net',
    smtpPort: 587,
    smtpSecure: false,
  },

  // Generic shared hosting (uses HTTP endpoint)
  generic: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'hosting' as const,
  },

  // Popular email service providers
  sendgrid: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'sendgrid' as const,
    providerConfig: {
      sendgrid: { apiKey: process.env.SENDGRID_API_KEY || '' }
    }
  },

  mailgun: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'mailgun' as const,
    providerConfig: {
      mailgun: {
        apiKey: process.env.MAILGUN_API_KEY || '',
        domain: process.env.MAILGUN_DOMAIN || ''
      }
    }
  },

  ses: {
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your MLM Platform',
    provider: 'ses' as const,
    providerConfig: {
      ses: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }
  }
};

// Helper function to get mail service for common providers
export function getHostingMailService(provider: keyof typeof HOSTING_MAIL_CONFIGS, customConfig?: Partial<MailConfig>): HostingMailService {
  const baseConfig = HOSTING_MAIL_CONFIGS[provider];
  const finalConfig = { ...baseConfig, ...customConfig };
  return createHostingMailService(finalConfig);
}