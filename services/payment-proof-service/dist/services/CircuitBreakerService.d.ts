export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
    name: string;
}
export declare class CircuitBreaker {
    private config;
    private failures;
    private lastFailureTime;
    private state;
    private nextAttemptTime;
    constructor(config: CircuitBreakerConfig);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): CircuitState;
    getStats(): {
        state: CircuitState;
        failures: number;
        lastFailureTime: number;
        nextAttemptTime: number;
    };
    reset(): void;
}
export declare class CircuitBreakerService {
    private breakers;
    createBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    getBreaker(serviceName: string): CircuitBreaker | undefined;
    getAllStats(): Record<string, any>;
    resetBreaker(serviceName: string): boolean;
    resetAll(): void;
}
export declare const circuitBreakerService: CircuitBreakerService;
export declare const emailServiceBreaker: CircuitBreaker;
export declare const smsServiceBreaker: CircuitBreaker;
export declare const ocrServiceBreaker: CircuitBreaker;
export declare const fileStorageBreaker: CircuitBreaker;
//# sourceMappingURL=CircuitBreakerService.d.ts.map