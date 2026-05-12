// =============================================================================
// HOSTING MAIL SERVICE - Production-Ready Email Delivery
// =============================================================================

import { logger } from '../src/lib/logger';
import { sanitizeEmail, sanitizeString, isSuspicious } from '../src/lib/input-sanitization';
import { RateLimitStore } from '../src/lib/rate-limiter';

// Interfaces and Custom Errors
export interface MailConfig {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  rateLimit?: { maxEmailsPerHour?: number; maxEmailsPerDay?: number };
  retry?: { maxAttempts?: number; backoffMs?: number };
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
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string; }>;
}

export interface EmailTemplate { name: string; subject: string; html: string; text?: string; }
export interface SendResult { success: boolean; messageId?: string; error?: string; attempts?: number; }
export class EmailValidationError extends Error { constructor(message: string) { super(message); this.name = 'EmailValidationError'; } }
export class EmailSendError extends Error { constructor(message: string) { super(message); this.name = 'EmailSendError'; } }
export class RateLimitError extends Error { constructor(message: string) { super(message); this.name = 'RateLimitError'; } }


export class HostingMailService {
  private config: MailConfig;
  private rateLimitStore: RateLimitStore;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(config: MailConfig, rateLimitStore?: RateLimitStore) {
    this.config = {
      rateLimit: { maxEmailsPerHour: 100, maxEmailsPerDay: 1000 },
      retry: { maxAttempts: 3, backoffMs: 1000 },
      ...config
    };
    this.rateLimitStore = rateLimitStore || new RateLimitStore();
  }

  async sendEmail(message: MailMessage): Promise<SendResult> {
    const validationResult = this.validateMessage(message);
    if (!validationResult.valid) {
      logger.warn('Email validation failed', { error: validationResult.error });
      return { success: false, error: validationResult.error };
    }

    try {
      await this.checkRateLimits();
    } catch (error) {
      logger.warn('Rate limit exceeded', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }

    return this.sendWithRetry(message);
  }

  private validateMessage(message: MailMessage): { valid: boolean; error?: string } {
    if (!message.to || (Array.isArray(message.to) && !message.to.length)) return { valid: false, error: 'Recipient is required' };
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    if (recipients.some(r => !sanitizeEmail(r))) return { valid: false, error: 'Invalid email address provided' };
    if (!message.subject) return { valid: false, error: 'Subject is required' };
    if (!message.message) return { valid: false, error: 'Message body is required' };
    if (isSuspicious(message.subject) || isSuspicious(message.message)) return { valid: false, error: 'Email content contains suspicious patterns' };
    return { valid: true };
  }

  private async checkRateLimits(): Promise<void> {
    const now = Date.now();
    const hourlyKey = `email_hour_${this.config.fromEmail}`;
    const dailyKey = `email_day_${this.config.fromEmail}`;
    const hourlyLimit = this.config.rateLimit?.maxEmailsPerHour || 100;
    const dailyLimit = this.config.rateLimit?.maxEmailsPerDay || 1000;

    const hourlyCount = await this.rateLimitStore.get(hourlyKey) || 0;
    if (hourlyCount >= hourlyLimit) throw new RateLimitError('Hourly email limit exceeded');

    const dailyCount = await this.rateLimitStore.get(dailyKey) || 0;
    if (dailyCount >= dailyLimit) throw new RateLimitError('Daily email limit exceeded');

    await this.rateLimitStore.increment(hourlyKey, 3600);
    await this.rateLimitStore.increment(dailyKey, 86400);
  }

  private async sendWithRetry(message: MailMessage): Promise<SendResult> {
    const maxAttempts = this.config.retry?.maxAttempts || 3;
    const backoffMs = this.config.retry?.backoffMs || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.sendEmailDirect(message);
        return { ...result, attempts: attempt };
      } catch (error) {
        logger.warn(`Email send attempt ${attempt} failed`, { error: (error as Error).message });
        if (attempt === maxAttempts) {
          return { success: false, error: (error as Error).message, attempts: attempt };
        }
        await new Promise(resolve => setTimeout(resolve, backoffMs * 2 ** (attempt - 1)));
      }
    }
    return { success: false, error: 'All retry attempts failed', attempts: maxAttempts };
  }

  private async sendEmailDirect(message: MailMessage): Promise<SendResult> {
    const provider = this.config.provider || 'smtp';
    switch (provider) {
      case 'sendgrid': return this.sendViaSendGrid(message);
      case 'mailgun': return this.sendViaMailgun(message);
      case 'ses': return this.sendViaSES(message);
      case 'smtp':
      default: return this.sendViaSMTP(message);
    }
  }

  private async sendViaSMTP(message: MailMessage): Promise<SendResult> {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: { user: this.config.smtpUser, pass: this.config.smtpPass },
      });
      const info = await transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: message.to, subject: message.subject, html: message.message, attachments: message.attachments,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      throw new EmailSendError(`SMTP send failed: ${(error as Error).message}`);
    }
  }

  private async sendViaSendGrid(message: MailMessage): Promise<SendResult> {
    try {
      const { apiKey } = this.config.providerConfig?.sendgrid || {};
      if (!apiKey) throw new EmailSendError('SendGrid API key not configured');
      const sendgrid = await import('@sendgrid/mail');
      sendgrid.setApiKey(apiKey);
      const [result] = await sendgrid.send({ to: message.to, from: { email: this.config.fromEmail, name: this.config.fromName }, subject: message.subject, html: message.message });
      return { success: true, messageId: result.headers['x-message-id'] };
    } catch (error) {
      throw new EmailSendError(`SendGrid send failed: ${(error as Error).message}`);
    }
  }

  private async sendViaMailgun(message: MailMessage): Promise<SendResult> {
    try {
        const { apiKey, domain } = this.config.providerConfig?.mailgun || {};
        if (!apiKey || !domain) throw new EmailSendError('Mailgun API key or domain not configured');
        const mailgun = (await import('mailgun.js')).default;
        const mg = mailgun.client({ username: 'api', key: apiKey });
        const result = await mg.messages.create(domain, { from: `${this.config.fromName} <${this.config.fromEmail}>`, to: message.to, subject: message.subject, html: message.message });
        return { success: true, messageId: result.id };
    } catch (error) {
        throw new EmailSendError(`Mailgun send failed: ${(error as Error).message}`);
    }
  }

  private async sendViaSES(message: MailMessage): Promise<SendResult> {
      try {
        const { accessKeyId, secretAccessKey, region } = this.config.providerConfig?.ses || {};
        if (!accessKeyId || !secretAccessKey || !region) throw new EmailSendError('AWS SES credentials not configured');
        const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
        const sesClient = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
        const result = await sesClient.send(new SendEmailCommand({ Source: `${this.config.fromName} <${this.config.fromEmail}>`, Destination: { ToAddresses: Array.isArray(message.to) ? message.to : [message.to] }, Message: { Subject: { Data: message.subject }, Body: { Html: { Data: message.message } } } }));
        return { success: true, messageId: result.MessageId };
      } catch (error) {
          throw new EmailSendError(`AWS SES send failed: ${(error as Error).message}`);
      }
  }
  
  registerTemplate(template: EmailTemplate): void { this.templates.set(template.name, template); }

  async sendTemplatedEmail(to: string | string[], templateName: string, variables: Record<string, any>): Promise<SendResult> {
    const template = this.templates.get(templateName);
    if (!template) return { success: false, error: `Template '${templateName}' not found` };
    const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key]);
    const message = template.html.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key]);
    return this.sendEmail({ to, subject, message });
  }
}
