/**
 * INPUT VALIDATION MIDDLEWARE
 * 
 * Provides consistent input validation and sanitization across API routes
 * 
 * Features:
 * - Zod schema validation wrapper
 * - Input sanitization
 * - Request size limits
 * - Type coercion and normalization
 * 
 * Created: 2025-10-19 (Audit Fix)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { logger } from './logger';

const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_STRING_LENGTH = 100000; // 100KB for strings

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters and patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=\s*["'].*?["']/gi, '') // Remove inline event handlers
    .trim()
    .substring(0, MAX_STRING_LENGTH); // Limit length
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const sanitizedKey = sanitizeString(key);
      
      // Sanitize value
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  return obj;
}

/**
 * Validate request body size
 */
export function validateRequestSize(request: NextRequest): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    logger.warn('Request body too large', {
      size: contentLength,
      maxSize: MAX_REQUEST_SIZE,
      url: request.url
    });
    return false;
  }
  return true;
}

/**
 * Middleware wrapper for Zod schema validation
 */
export function withValidation<T extends ZodSchema>(
  schema: T,
  handler: (
    request: NextRequest,
    validatedData: z.infer<T>,
    context?: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      // Check request size
      if (!validateRequestSize(request)) {
        return NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 }
        );
      }

      // Parse request body
      let body: any;
      try {
        const text = await request.text();
        body = text ? JSON.parse(text) : {};
      } catch (error) {
        logger.warn('Invalid JSON in request body', {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: request.url
        });
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }

      // Sanitize input
      const sanitizedBody = sanitizeObject(body);

      // Validate with schema
      const result = schema.safeParse(sanitizedBody);

      if (!result.success) {
        logger.warn('Validation failed', {
          errors: result.error.errors,
          url: request.url
        });
        
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: result.error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        );
      }

      // Call handler with validated data
      return handler(request, result.data, context);
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: request.url
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Validate specific field types
 */
export const ValidationSchemas = {
  email: z.string().email().toLowerCase(),
  
  phone: z.string().min(10).max(15).regex(/^[\d\s\+\-\(\)]+$/),
  
  password: z.string().min(8).max(100),
  
  memberId: z.string().min(3).max(50).regex(/^[A-Z0-9\-]+$/),
  
  amount: z.number().positive().finite(),
  
  url: z.string().url().max(2000),
  
  positiveInt: z.number().int().positive(),
  
  nonNegativeInt: z.number().int().min(0),
  
  id: z.string().cuid(),
  
  dateString: z.string().datetime(),
  
  limitedString: (maxLength: number = 255) =>
    z.string().max(maxLength).transform(sanitizeString),
  
  optionalString: (maxLength: number = 255) =>
    z.string().max(maxLength).transform(sanitizeString).optional(),
};

/**
 * Common validation rules for API endpoints
 */
export const CommonSchemas = {
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),

  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }).refine(
    (data) => new Date(data.startDate) < new Date(data.endDate),
    { message: 'Start date must be before end date' }
  ),

  companyFilter: z.object({
    companyId: z.string().cuid().optional()
  }),

  memberFilter: z.object({
    memberId: z.string().optional()
  }),

  statusFilter: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'active', 'inactive']).optional()
  })
};

/**
 * Sanitize and validate request parameters
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; details?: any }> {
  try {
    // Check request size
    if (!validateRequestSize(request)) {
      return {
        success: false,
        error: 'Request body too large'
      };
    }

    // Parse body
    let body: any;
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        error: 'Invalid JSON'
      };
    }

    // Sanitize
    const sanitized = sanitizeObject(body);

    // Validate
    const result = schema.safeParse(sanitized);

    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        details: result.error.errors
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    logger.error('Request validation error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return {
      success: false,
      error: 'Validation error'
    };
  }
}

/**
 * Normalize email address
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone number (remove formatting)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Validate and sanitize array of IDs
 */
export function validateIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  
  return ids
    .filter(id => typeof id === 'string')
    .map(id => sanitizeString(id))
    .filter(id => id.length > 0 && id.length < 100);
}

/**
 * Safe integer parsing with bounds
 */
export function safeParseInt(value: unknown, defaultValue: number = 0, min?: number, max?: number): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }
  
  let result = Math.floor(parsed);
  
  if (min !== undefined) {
    result = Math.max(min, result);
  }
  
  if (max !== undefined) {
    result = Math.min(max, result);
  }
  
  return result;
}

/**
 * Safe float parsing with bounds
 */
export function safeParseFloat(value: unknown, defaultValue: number = 0, min?: number, max?: number): number {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }
  
  let result = parsed;
  
  if (min !== undefined) {
    result = Math.max(min, result);
  }
  
  if (max !== undefined) {
    result = Math.min(max, result);
  }
  
  return result;
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: File, options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}): { valid: boolean; error?: string } {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  } = options;

  // Check size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / 1024 / 1024}MB limit`
    };
  }

  // Check type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed`
    };
  }

  // Check extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension ${extension} not allowed`
    };
  }

  return { valid: true };
}