"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateUtils = exports.RateLimitUtils = exports.CacheUtils = exports.PerformanceUtils = exports.ValidationUtils = exports.EventUtils = exports.ResponseUtils = exports.ServiceErrorHandler = void 0;
exports.generateRequestId = generateRequestId;
exports.generateCorrelationId = generateCorrelationId;
exports.roundToDecimal = roundToDecimal;
const crypto_1 = require("crypto");
// Request ID generator for tracing
function generateRequestId() {
    return `req_${(0, crypto_1.randomUUID)()}`;
}
// Correlation ID for distributed tracing
function generateCorrelationId() {
    return `corr_${(0, crypto_1.randomUUID)()}`;
}
// Error handling utilities
class ServiceErrorHandler {
    static createError(code, message, details) {
        return {
            code,
            message,
            details,
            timestamp: new Date().toISOString(),
            service: process.env.SERVICE_NAME || 'unknown',
            requestId: this.getCurrentRequestId(),
        };
    }
    static isServiceError(error) {
        return error && typeof error === 'object' && 'code' in error && 'service' in error;
    }
    static getCurrentRequestId() {
        // In a real implementation, this would be stored in async local storage
        return generateRequestId();
    }
}
exports.ServiceErrorHandler = ServiceErrorHandler;
// Response utilities
class ResponseUtils {
    static success(data, message, requestId) {
        return {
            success: true,
            data,
            message,
            timestamp: new Date().toISOString(),
            requestId: requestId || generateRequestId(),
            processingTime: 0, // Would be calculated by middleware
        };
    }
    static error(error, requestId) {
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
exports.ResponseUtils = ResponseUtils;
// Event utilities for event-driven architecture
class EventUtils {
    static createEvent(type, aggregateId, aggregateType, eventData, correlationId, causationId) {
        return {
            id: `evt_${(0, crypto_1.randomUUID)()}`,
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
exports.EventUtils = EventUtils;
// Validation utilities
class ValidationUtils {
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static isValidPhoneNumber(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }
    static sanitizeString(input) {
        return input.trim().replace(/[<>]/g, '');
    }
    static validateRequired(value, fieldName) {
        if (value === null || value === undefined || value === '') {
            throw ServiceErrorHandler.createError('VALIDATION_ERROR', `${fieldName} is required`);
        }
    }
}
exports.ValidationUtils = ValidationUtils;
// Performance utilities
class PerformanceUtils {
    static startTimer(name) {
        const timerId = `${name}_${Date.now()}`;
        this.metrics.set(timerId, performance.now());
        return timerId;
    }
    static endTimer(timerId) {
        const startTime = this.metrics.get(timerId);
        if (!startTime) {
            throw new Error(`Timer ${timerId} not found`);
        }
        const duration = performance.now() - startTime;
        this.metrics.delete(timerId);
        return duration;
    }
    static async measureAsync(name, operation) {
        const timerId = this.startTimer(name);
        try {
            const result = await operation();
            const duration = this.endTimer(timerId);
            return { result, duration };
        }
        catch (error) {
            this.endTimer(timerId);
            throw error;
        }
    }
}
exports.PerformanceUtils = PerformanceUtils;
PerformanceUtils.metrics = new Map();
// Cache utilities (Redis-based for scalability)
class CacheUtils {
    static async get(key) {
        const item = this.memoryCache.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expiry) {
            this.memoryCache.delete(key);
            return null;
        }
        return item.value;
    }
    static async set(key, value, ttlSeconds = 300) {
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.memoryCache.set(key, { value, expiry });
    }
    static async delete(key) {
        this.memoryCache.delete(key);
    }
    static async clear() {
        this.memoryCache.clear();
    }
}
exports.CacheUtils = CacheUtils;
// In a real implementation, this would use Redis
CacheUtils.memoryCache = new Map();
// Rate limiting utilities
class RateLimitUtils {
    static checkLimit(key, maxAttempts, windowSeconds) {
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
exports.RateLimitUtils = RateLimitUtils;
RateLimitUtils.attempts = new Map();
// Decimal precision helper
function roundToDecimal(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
// Date utilities
class DateUtils {
    static formatISO(date) {
        return date.toISOString();
    }
    static parseISO(dateString) {
        return new Date(dateString);
    }
    static getDaysDifference(startDate, endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    static isWithinDays(date, days) {
        const now = new Date();
        const diffDays = this.getDaysDifference(date, now);
        return diffDays <= days;
    }
}
exports.DateUtils = DateUtils;
//# sourceMappingURL=utils.js.map