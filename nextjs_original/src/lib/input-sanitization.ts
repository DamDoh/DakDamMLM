import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * COMPREHENSIVE INPUT SANITIZATION MIDDLEWARE
 * 
 * Prevents XSS, SQL Injection, and other injection attacks
 * by sanitizing and validating all user inputs.
 */

export interface SanitizationOptions {
  allowHTML?: boolean;
  maxLength?: number;
  stripScripts?: boolean;
  stripEventHandlers?: boolean;
}

export class InputSanitizer {
  /**
   * Sanitize string input - removes potentially dangerous content
   */
  static sanitizeString(input: string, options: SanitizationOptions = {}): string {
    const {
      allowHTML = false,
      maxLength = 10000,
      stripScripts = true,
      stripEventHandlers = true
    } = options;

    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Enforce maximum length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    if (!allowHTML) {
      // Remove all HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    } else {
      // If HTML is allowed, strip dangerous elements
      if (stripScripts) {
        // Remove script tags and their content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // Remove javascript: protocol
        sanitized = sanitized.replace(/javascript:/gi, '');
      }

      if (stripEventHandlers) {
        // Remove event handler attributes
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
      }
    }

    // Remove potentially dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /new\s+Function\s*\(/gi,
    ];

    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }

  /**
   * Sanitize object - recursively sanitize all string properties
   */
  static sanitizeObject<T extends Record<string, any>>(obj: T, options: SanitizationOptions = {}): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, options);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, options);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize email
   */
  static sanitizeEmail(email: string): string | null {
    if (!email || typeof email !== 'string') {
      return null;
    }

    const sanitized = email.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

    if (!emailRegex.test(sanitized)) {
      return null;
    }

    // Additional checks
    if (sanitized.length > 254) {
      return null;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Double dots
      /\s/,    // Whitespace
      /<|>/,   // HTML tags
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        return null;
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize phone number
   */
  static sanitizePhoneNumber(phone: string): string | null {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // Remove all non-digit characters except + at start
    let sanitized = phone.trim();
    const hasPlus = sanitized.startsWith('+');
    sanitized = sanitized.replace(/\D/g, '');

    if (hasPlus) {
      sanitized = '+' + sanitized;
    }

    // Phone numbers should be 10-15 digits
    const digitCount = sanitized.replace(/\D/g, '').length;
    if (digitCount < 10 || digitCount > 15) {
      return null;
    }

    return sanitized;
  }

  /**
   * Sanitize SQL input (for raw queries) - prevents SQL injection
   */
  static sanitizeSQL(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove SQL injection patterns
    const sqlPatterns = [
      /--/g,              // SQL comments
      /;/g,               // Statement separator
      /\/\*/g,            // Block comment start
      /\*\//g,            // Block comment end
      /xp_/gi,            // Extended procedures
      /sp_/gi,            // System procedures
      /exec\s/gi,         // Execute commands
      /execute\s/gi,      // Execute commands
      /drop\s/gi,         // Drop commands
      /delete\s/gi,       // Delete commands
      /truncate\s/gi,     // Truncate commands
      /alter\s/gi,        // Alter commands
      /create\s/gi,       // Create commands
    ];

    let sanitized = input;
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    return this.sanitizeString(sanitized, { allowHTML: false, maxLength: 1000 });
  }

  /**
   * Detect suspicious input patterns
   */
  static isSuspicious(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const suspiciousPatterns = [
      // XSS patterns
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
      /location\./i,
      /<iframe/i,
      /<object/i,
      /<embed/i,

      // SQL injection patterns
      /'\s*or\s*'1'\s*=\s*'1/i,
      /'\s*or\s*1\s*=\s*1/i,
      /union\s+select/i,
      /;\s*drop\s+table/i,
      /;\s*delete\s+from/i,

      // Command injection patterns
      /&&/,
      /\|\|/,
      /;\s*rm\s+-rf/i,
      /\$\(/,
      /`.*`/,

      // Path traversal
      /\.\.\//,
      /\.\.\\/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize file path - prevent path traversal
   */
  static sanitizeFilePath(path: string): string | null {
    if (!path || typeof path !== 'string') {
      return null;
    }

    let sanitized = path.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Check for path traversal attempts
    if (sanitized.includes('..')) {
      logger.security('Path traversal attempt detected', undefined, { path });
      return null;
    }

    // Remove leading slashes
    sanitized = sanitized.replace(/^\/+/, '');

    // Only allow alphanumeric, dash, underscore, dot, and forward slash
    if (!/^[a-zA-Z0-9_.\/-]+$/.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Sanitize URL - prevent open redirect and SSRF
   */
  static sanitizeURL(url: string, allowedDomains?: string[]): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      const parsedURL = new URL(url);

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedURL.protocol)) {
        logger.security('Suspicious URL protocol detected', undefined, { url, protocol: parsedURL.protocol });
        return null;
      }

      // Check against allowed domains if provided
      if (allowedDomains && allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some(domain => 
          parsedURL.hostname === domain || parsedURL.hostname.endsWith('.' + domain)
        );

        if (!isAllowed) {
          logger.security('URL domain not in whitelist', undefined, { url, hostname: parsedURL.hostname });
          return null;
        }
      }

      // Check for suspicious patterns in URL
      if (this.isSuspicious(url)) {
        logger.security('Suspicious URL pattern detected', undefined, { url });
        return null;
      }

      return parsedURL.toString();
    } catch (error) {
      logger.security('Invalid URL format', undefined, { url });
      return null;
    }
  }

  /**
   * Sanitize JSON input - prevent prototype pollution
   */
  static sanitizeJSON<T>(jsonString: string): T | null {
    try {
      const parsed = JSON.parse(jsonString);

      // Check for prototype pollution attempts
      if (this.hasPrototypePollution(parsed)) {
        logger.security('Prototype pollution attempt detected', undefined, { json: jsonString });
        return null;
      }

      return parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect prototype pollution attempts
   */
  private static hasPrototypePollution(obj: any): boolean {
    if (obj === null || typeof obj !== 'object') {
      return false;
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return true;
      }

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (this.hasPrototypePollution(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Middleware wrapper for automatic input sanitization
 */
export function withInputSanitization(
  handler: (request: NextRequest, sanitizedBody?: any) => Promise<NextResponse>,
  options: SanitizationOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Get request body
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const bodyText = await request.text();
        
        // Validate JSON isn't malicious
        if (InputSanitizer.isSuspicious(bodyText)) {
          logger.security('Suspicious input detected in request body', undefined, {
            url: request.url,
            ip: request.headers.get('x-forwarded-for')
          }, request);
          
          return NextResponse.json(
            { error: 'Invalid input detected' },
            { status: 400 }
          );
        }

        // Parse and sanitize JSON
        const parsedBody = InputSanitizer.sanitizeJSON(bodyText);
        if (parsedBody === null || typeof parsedBody !== 'object') {
          return NextResponse.json(
            { error: 'Invalid JSON input' },
            { status: 400 }
          );
        }

        // Sanitize all string values in body
        const sanitizedBody = InputSanitizer.sanitizeObject(parsedBody as Record<string, any>, options);
        
        // Call handler with sanitized body
        return handler(request, sanitizedBody);
      }

      // For non-JSON requests, call handler without sanitized body
      return handler(request);
    } catch (error) {
      logger.error('Input sanitization error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: request.url
      }, request);

      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }
  };
}

/**
 * Validate request contains no suspicious patterns
 */
export function validateRequestSafety(request: NextRequest): {
  safe: boolean;
  reason?: string;
} {
  // Check user agent for known malicious patterns
  const userAgent = request.headers.get('user-agent') || '';
  const maliciousAgents = [
    'sqlmap', 'nmap', 'masscan', 'nikto', 'dirbuster',
    'gobuster', 'wfuzz', 'burp', 'metasploit'
  ];

  for (const agent of maliciousAgents) {
    if (userAgent.toLowerCase().includes(agent)) {
      return {
        safe: false,
        reason: `Malicious user agent detected: ${agent}`
      };
    }
  }

  // Check for suspicious headers
  const referer = request.headers.get('referer') || '';
  if (referer && InputSanitizer.isSuspicious(referer)) {
    return {
      safe: false,
      reason: 'Suspicious referer header'
    };
  }

  // Check URL for suspicious patterns
  const url = request.url;
  if (InputSanitizer.isSuspicious(url)) {
    return {
      safe: false,
      reason: 'Suspicious URL pattern'
    };
  }

  return { safe: true };
}

/**
 * Sanitization middleware for API routes
 */
export function sanitizeApiInput(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Validate request safety
    const safetyCheck = validateRequestSafety(request);
    if (!safetyCheck.safe) {
      logger.security('Unsafe request blocked', undefined, {
        reason: safetyCheck.reason,
        url: request.url,
        ip: request.headers.get('x-forwarded-for')
      }, request);

      return NextResponse.json(
        { error: 'Request blocked for security reasons' },
        { status: 403 }
      );
    }

    // Continue with handler
    return handler(request, context);
  };
}

// Convenience exports
export const sanitizeString = InputSanitizer.sanitizeString.bind(InputSanitizer);
export const sanitizeObject = InputSanitizer.sanitizeObject.bind(InputSanitizer);
export const sanitizeEmail = InputSanitizer.sanitizeEmail.bind(InputSanitizer);
export const sanitizePhoneNumber = InputSanitizer.sanitizePhoneNumber.bind(InputSanitizer);
export const sanitizeFilePath = InputSanitizer.sanitizeFilePath.bind(InputSanitizer);
export const sanitizeURL = InputSanitizer.sanitizeURL.bind(InputSanitizer);
export const isSuspicious = InputSanitizer.isSuspicious.bind(InputSanitizer);