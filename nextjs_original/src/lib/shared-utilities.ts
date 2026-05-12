/**
 * CONSOLIDATED SHARED UTILITIES
 * 
 * This file consolidates duplicate utility functions from:
 * - src/lib/shared-utils.ts
 * - services/shared/utils.ts
 * - src/lib/security.ts
 * 
 * Single source of truth for common utilities.
 */

import { randomBytes } from 'crypto';
import type { Member } from './types';

// ============================================================================
// DECIMAL PRECISION UTILITIES
// ============================================================================

/**
 * Round number to specified decimal places
 * Consolidated from multiple implementations
 */
export function roundToDecimal(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export class ValidationUtils {
  /**
   * Validate email format - RFC 5322 compliant
   */
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate phone number - international format
   */
  static isValidPhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate required field
   */
  static validateRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${fieldName} is required`);
    }
  }

  /**
   * Validate number range
   */
  static validateRange(value: number, min: number, max: number, fieldName: string): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    if (value < min || value > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
  }

  /**
   * Validate array not empty
   */
  static validateNotEmpty<T>(arr: T[], fieldName: string): void {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`${fieldName} must not be empty`);
    }
  }
}

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

export class SecurityUtils {
  /**
   * Generate cryptographically secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate secure random bytes
   */
  static generateSecureBytes(length: number = 32): Buffer {
    return randomBytes(length);
  }

  /**
   * Hash data for logging (one-way)
   */
  static hashForLogging(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) return '***';
    return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
  }

  /**
   * Check if string contains suspicious patterns
   */
  static containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
      /location\./i,
      /\.\.\//,  // Path traversal
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

export class DateUtils {
  /**
   * Format date to ISO string
   */
  static formatISO(date: Date): string {
    return date.toISOString();
  }

  /**
   * Parse ISO string to date
   */
  static parseISO(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Get difference in days between two dates
   */
  static getDaysDifference(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if date is within specified days from now
   */
  static isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const diffDays = this.getDaysDifference(date, now);
    return diffDays <= days;
  }

  /**
   * Get start of day
   */
  static startOfDay(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get end of day
   */
  static endOfDay(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Add days to date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Format date for display
   */
  static formatDisplay(date: Date, locale: string = 'en-US'): string {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

export class PerformanceUtils {
  private static metrics = new Map<string, number>();

  /**
   * Start performance timer
   */
  static startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(timerId, performance.now());
    return timerId;
  }

  /**
   * End performance timer and get duration
   */
  static endTimer(timerId: string): number {
    const startTime = this.metrics.get(timerId);
    if (!startTime) {
      throw new Error(`Timer ${timerId} not found`);
    }

    const duration = performance.now() - startTime;
    this.metrics.delete(timerId);
    return Math.round(duration * 100) / 100; // Round to 2 decimals
  }

  /**
   * Measure async operation performance
   */
  static async measureAsync<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const timerId = this.startTimer(name);
    try {
      const result = await operation();
      const duration = this.endTimer(timerId);
      return { result, duration };
    } catch (error) {
      this.endTimer(timerId);
      throw error;
    }
  }

  /**
   * Debounce function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), waitMs);
    };
  }

  /**
   * Throttle function
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limitMs: number
  ): (...args: Parameters<T>) => void {
    let lastRun = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRun >= limitMs) {
        func(...args);
        lastRun = now;
      }
    };
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

export class ErrorUtils {
  /**
   * Check if error is operational (expected) vs programmer error
   */
  static isOperationalError(error: any): boolean {
    if (error.isOperational !== undefined) {
      return error.isOperational;
    }

    // Check error name/type
    const operationalErrorTypes = [
      'ValidationError',
      'AuthenticationError',
      'NotFoundError',
      'ConflictError',
      'ForbiddenError'
    ];

    return operationalErrorTypes.includes(error.name);
  }

  /**
   * Extract error message safely
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unknown error occurred';
  }

  /**
   * Create structured error object
   */
  static createError(
    code: string,
    message: string,
    details?: Record<string, any>
  ): Error & { code: string; details?: Record<string, any> } {
    const error = new Error(message) as any;
    error.code = code;
    error.details = details;
    error.timestamp = new Date().toISOString();
    return error;
  }
}

// ============================================================================
// DATA TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Transform Prisma User to Member type
 */
export function transformUserToMember(user: any): Member {
  return {
    id: user.id,
    memberId: user.memberId || '',
    firstName: user.firstName,
    surname: user.surname,
    fullName: user.fullName,
    email: user.email || '',
    avatarUrl: user.avatarUrl || '/images/default-avatar.png',
    rank: user.rank || 'Member',
    storeOwnerLevel: user.storeOwnerLevel || null,
    accountType: user.accountType || 'Customer',
    pv: user.pv || 0,
    pvDate: user.pvDate?.toISOString(),
    teamSize: typeof user.teamSize === 'object' ? user.teamSize : { left: 0, right: 0, total: 0 },
    joinDate: user.createdAt?.toISOString() || new Date().toISOString(),
    sponsorId: user.sponsorId || null,
    placementParentId: user.placementParentId || null,
    position: user.position || null,
    children: typeof user.children === 'object' ? user.children : { left: null, right: null },
    active: user.active ?? true,
    phoneNumber: user.phoneNumber,
    lastActivityDate: user.lastActivityDate?.toISOString(),
    isAdmin: user.isAdmin ?? false,
    addresses: Array.isArray(user.addresses) ? user.addresses : [],
  };
}

/**
 * Deep clone object (JSON-safe)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.trim().length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJSONParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

// ============================================================================
// AUDIT LOGGING UTILITIES
// ============================================================================

export interface CalculationAudit {
  memberId: string;
  calculationType: string;
  cycleId: string;
  inputs: Record<string, any>;
  result: number;
  duration: number;
}

/**
 * Log calculation for audit trail
 */
export function logCalculationAudit(audit: CalculationAudit): void {
  // In production, send to audit service
  console.log(`[AUDIT] ${audit.calculationType} for ${audit.memberId}: $${audit.result} (${audit.duration}ms)`);
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Re-export from services for consistency
export {
  generateRequestId,
  generateCorrelationId,
  ServiceErrorHandler,
  ResponseUtils,
  EventUtils,
  CacheUtils,
  RateLimitUtils,
} from '../../services/shared/utils';

// Export validation utils for convenience
export { ValidationUtils as Validators };
export { SecurityUtils as Security };
export { DateUtils as Dates };
export { PerformanceUtils as Performance };
export { ErrorUtils as Errors };