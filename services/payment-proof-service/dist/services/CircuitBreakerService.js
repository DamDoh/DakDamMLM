"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileStorageBreaker = exports.ocrServiceBreaker = exports.smsServiceBreaker = exports.emailServiceBreaker = exports.circuitBreakerService = exports.CircuitBreakerService = exports.CircuitBreaker = void 0;
const index_1 = require("../index");
class CircuitBreaker {
    constructor(config) {
        this.config = config;
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = 'CLOSED';
        this.nextAttemptTime = 0;
    }
    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() >= this.nextAttemptTime) {
                this.state = 'HALF_OPEN';
                index_1.logger.info(`Circuit breaker ${this.config.name} entering HALF_OPEN state`);
            }
            else {
                throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
            }
        }
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
        index_1.logger.info(`Circuit breaker ${this.config.name} reset to CLOSED state`);
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.config.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
            index_1.logger.warn(`Circuit breaker ${this.config.name} opened after ${this.failures} failures`);
        }
    }
    getState() {
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
    reset() {
        this.failures = 0;
        this.state = 'CLOSED';
        this.nextAttemptTime = 0;
        index_1.logger.info(`Circuit breaker ${this.config.name} manually reset`);
    }
}
exports.CircuitBreaker = CircuitBreaker;
class CircuitBreakerService {
    constructor() {
        this.breakers = new Map();
    }
    createBreaker(serviceName, config) {
        const defaultConfig = {
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
    getBreaker(serviceName) {
        return this.breakers.get(serviceName);
    }
    getAllStats() {
        const stats = {};
        for (const [name, breaker] of this.breakers) {
            stats[name] = breaker.getStats();
        }
        return stats;
    }
    resetBreaker(serviceName) {
        const breaker = this.breakers.get(serviceName);
        if (breaker) {
            breaker.reset();
            return true;
        }
        return false;
    }
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
        index_1.logger.info('All circuit breakers reset');
    }
}
exports.CircuitBreakerService = CircuitBreakerService;
// Global circuit breaker service instance
exports.circuitBreakerService = new CircuitBreakerService();
// Pre-configured breakers for common services
exports.emailServiceBreaker = exports.circuitBreakerService.createBreaker('email-service', {
    failureThreshold: 3,
    recoveryTimeout: 30000 // 30 seconds
});
exports.smsServiceBreaker = exports.circuitBreakerService.createBreaker('sms-service', {
    failureThreshold: 3,
    recoveryTimeout: 30000
});
exports.ocrServiceBreaker = exports.circuitBreakerService.createBreaker('ocr-service', {
    failureThreshold: 5,
    recoveryTimeout: 120000 // 2 minutes
});
exports.fileStorageBreaker = exports.circuitBreakerService.createBreaker('file-storage', {
    failureThreshold: 3,
    recoveryTimeout: 60000
});
//# sourceMappingURL=CircuitBreakerService.js.map