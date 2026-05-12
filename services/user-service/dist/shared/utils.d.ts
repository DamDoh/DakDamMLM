import { ServiceError, ApiResponse, DomainEvent } from './types';
export declare function generateRequestId(): string;
export declare function generateCorrelationId(): string;
export declare class ServiceErrorHandler {
    static createError(code: string, message: string, details?: Record<string, any>): ServiceError;
    static isServiceError(error: any): error is ServiceError;
    private static getCurrentRequestId;
}
export declare class ResponseUtils {
    static success<T>(data: T, message?: string, requestId?: string): ApiResponse<T>;
    static error(error: string | ServiceError, requestId?: string): ApiResponse<null>;
}
export declare class EventUtils {
    static createEvent(type: string, aggregateId: string, aggregateType: string, eventData: Record<string, any>, correlationId?: string, causationId?: string): DomainEvent;
}
export declare class ValidationUtils {
    static isValidEmail(email: string): boolean;
    static isValidPhoneNumber(phone: string): boolean;
    static isValidUUID(uuid: string): boolean;
    static sanitizeString(input: string): string;
    static validateRequired(value: any, fieldName: string): void;
}
export declare class PerformanceUtils {
    private static metrics;
    static startTimer(name: string): string;
    static endTimer(timerId: string): number;
    static measureAsync<T>(name: string, operation: () => Promise<T>): Promise<{
        result: T;
        duration: number;
    }>;
}
export declare class CacheUtils {
    private static memoryCache;
    static get<T>(key: string): Promise<T | null>;
    static set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    static delete(key: string): Promise<void>;
    static clear(): Promise<void>;
}
export declare class RateLimitUtils {
    private static attempts;
    static checkLimit(key: string, maxAttempts: number, windowSeconds: number): {
        allowed: boolean;
        remaining: number;
        resetTime: number;
    };
}
export declare function roundToDecimal(value: number, decimals?: number): number;
export declare class DateUtils {
    static formatISO(date: Date): string;
    static parseISO(dateString: string): Date;
    static getDaysDifference(startDate: Date, endDate: Date): number;
    static isWithinDays(date: Date, days: number): boolean;
}
//# sourceMappingURL=utils.d.ts.map