import { logger } from '../index';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time in ms before trying again
  monitoringPeriod: number; // Time window for failure counting
  name: string; // Identifier for logging
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitState = 'CLOSED';
  private nextAttemptTime = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker ${this.config.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    logger.info(`Circuit breaker ${this.config.name} reset to CLOSED state`);
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      logger.warn(`Circuit breaker ${this.config.name} opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  // Force reset (for admin operations)
  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.nextAttemptTime = 0;
    logger.info(`Circuit breaker ${this.config.name} manually reset`);
  }
}

export class CircuitBreakerService {
  private breakers = new Map<string, CircuitBreaker>();

  createBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      name: serviceName
    };

    const finalConfig = { ...defaultConfig, ...config };
    const breaker = new CircuitBreaker(finalConfig);
    this.breakers.set(serviceName, breaker);
    return breaker;
  }

  getBreaker(serviceName: string): CircuitBreaker | undefined {
    return this.breakers.get(serviceName);
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  resetBreaker(serviceName: string): boolean {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }
}

// Global circuit breaker service instance
export const circuitBreakerService = new CircuitBreakerService();

// Pre-configured breakers for common services
export const emailServiceBreaker = circuitBreakerService.createBreaker('email-service', {
  failureThreshold: 3,
  recoveryTimeout: 30000 // 30 seconds
});

export const smsServiceBreaker = circuitBreakerService.createBreaker('sms-service', {
  failureThreshold: 3,
  recoveryTimeout: 30000
});

export const ocrServiceBreaker = circuitBreakerService.createBreaker('ocr-service', {
  failureThreshold: 5,
  recoveryTimeout: 120000 // 2 minutes
});

export const fileStorageBreaker = circuitBreakerService.createBreaker('file-storage', {
  failureThreshold: 3,
  recoveryTimeout: 60000
});