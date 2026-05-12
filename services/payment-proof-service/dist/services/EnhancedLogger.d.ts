export interface LogContext {
    correlationId?: string;
    userId?: string;
    proofId?: string;
    orderId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    [key: string]: any;
}
export declare class EnhancedLogger {
    private logger;
    constructor();
    private createLogger;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    logAPIRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void;
    logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void;
    logPerformance(operation: string, duration: number, context?: LogContext): void;
    logBusinessEvent(event: string, context?: LogContext): void;
    logDatabaseQuery(query: string, duration: number, context?: LogContext): void;
    logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, context?: LogContext): void;
    logCircuitBreakerEvent(serviceName: string, event: 'open' | 'close' | 'half_open', context?: LogContext): void;
    private enrichContext;
    generateCorrelationId(): string;
    child(context: LogContext): EnhancedLogger;
    healthCheck(): Promise<boolean>;
    flush(): Promise<void>;
    getStats(): any;
    log(level: string, message: string, context?: LogContext): void;
}
export declare const enhancedLogger: EnhancedLogger;
export declare const logWithContext: (level: string, message: string, context?: LogContext) => void;
export declare const createCorrelationId: () => string;
export declare const correlationMiddleware: (req: any, res: any, next: any) => void;
//# sourceMappingURL=EnhancedLogger.d.ts.map