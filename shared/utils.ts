import { randomUUID } from 'crypto';
import { ServiceError, ApiResponse, DomainEvent } from './types';

// Request ID generator for tracing
export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}

// Correlation ID for distributed tracing
export function generateCorrelationId(): string {
  return `corr_${randomUUID()}`;
}

// Error handling utilities
export class ServiceErrorHandler {
  static createError(
    code: string,
    message: string,
    details?: Record<string, any>
  ): ServiceError {
    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      requestId: this.getCurrentRequestId(),
    };
  }

  static isServiceError(error: any): error is ServiceError {
    return error && typeof error === 'object' && 'code' in error && 'service' in error;
  }

  private static getCurrentRequestId(): string {
    // In a real implementation, this would be stored in async local storage
    return generateRequestId();
  }
}

// Response utilities
export class ResponseUtils {
  static success<T>(data: T, message?: string, requestId?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      processingTime: 0, // Would be calculated by middleware
    };
  }

  static error(error: string | ServiceError, requestId?: string): ApiResponse<null> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorCode = typeof error === 'object' ? error.code : 'INTERNAL_ERROR';

    return {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
      processingTime: 0,
    };
  }
}

// Event utilities for event-driven architecture
export class EventUtils {
  static createEvent(
    type: string,
    aggregateId: string,
    aggregateType: string,
    eventData: Record<string, any>,
    correlationId?: string,
    causationId?: string
  ): DomainEvent {
    return {
      id: `evt_${randomUUID()}`,
      type,
      aggregateId,
      aggregateType,
      eventData,
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId: correlationId || generateCorrelationId(),
        causationId,
        version: 1,
      },
    };
  }
}

// Validation utilities
export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  static validateRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
      throw ServiceErrorHandler.createError(
        'VALIDATION_ERROR',
        `${fieldName} is required`
      );
    }
  }
}

// Performance utilities
export class PerformanceUtils {
  private static metrics = new Map<string, number>();

  static startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}`;
    this.metrics.set(timerId, performance.now());
    return timerId;
  }

  static endTimer(timerId: string): number {
    const startTime = this.metrics.get(timerId);
    if (!startTime) {
      throw new Error(`Timer ${timerId} not found`);
    }

    const duration = performance.now() - startTime;
    this.metrics.delete(timerId);
    return duration;
  }

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
}

// Cache utilities (Redis-based for scalability)
export class CacheUtils {
  // In a real implementation, this would use Redis
  private static memoryCache = new Map<string, { value: any; expiry: number }>();

  static async get<T>(key: string): Promise<T | null> {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.value as T;
  }

  static async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { value, expiry });
  }

  static async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  static async clear(): Promise<void> {
    this.memoryCache.clear();
  }
}

// Rate limiting utilities
export class RateLimitUtils {
  private static attempts = new Map<string, { count: number; resetTime: number }>();

  static checkLimit(
    key: string,
    maxAttempts: number,
    windowSeconds: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetTime = now + windowMs;

    const existing = this.attempts.get(key);

    if (!existing || now > existing.resetTime) {
      this.attempts.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: maxAttempts - 1, resetTime };
    }

    if (existing.count >= maxAttempts) {
      return { allowed: false, remaining: 0, resetTime: existing.resetTime };
    }

    existing.count++;
    return {
      allowed: true,
      remaining: maxAttempts - existing.count,
      resetTime: existing.resetTime
    };
  }
}

// Decimal precision helper
export function roundToDecimal(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Date utilities
export class DateUtils {
  static formatISO(date: Date): string {
    return date.toISOString();
  }

  static parseISO(dateString: string): Date {
    return new Date(dateString);
  }

  static getDaysDifference(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const diffDays = this.getDaysDifference(date, now);
    return diffDays <= days;
  }
}