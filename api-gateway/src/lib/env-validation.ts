// Environment Configuration Validation
// Ensures all required environment variables are set for production

import { logger } from './logger';

interface EnvConfig {
  // Database
  DATABASE_URL: string;

  // Authentication
  JWT_SECRET: string;
  JWT_REFRESH_SECRET?: string;

  // Encryption
  ENCRYPTION_KEY: string;

  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_APP_URL: string;

  // Optional services
  REDIS_URL?: string;
  SMTP_HOST?: string;
  SMS_PROVIDER?: string;
}

class EnvironmentValidator {
  private config: EnvConfig;
  private errors: string[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): EnvConfig {
    return {
      DATABASE_URL: process.env.DATABASE_URL!,
      JWT_SECRET: process.env.JWT_SECRET!,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
      NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      REDIS_URL: process.env.REDIS_URL,
      SMTP_HOST: process.env.SMTP_HOST,
      SMS_PROVIDER: process.env.SMS_PROVIDER,
    };
  }

  private validateConfig(): void {
    // Required in all environments
    this.validateRequired('DATABASE_URL', this.config.DATABASE_URL);
    this.validateRequired('JWT_SECRET', this.config.JWT_SECRET);
    this.validateRequired('NEXT_PUBLIC_APP_URL', this.config.NEXT_PUBLIC_APP_URL);

    // Required in production
    if (this.config.NODE_ENV === 'production') {
      this.validateRequired('ENCRYPTION_KEY', this.config.ENCRYPTION_KEY);
      this.validateRequired('JWT_REFRESH_SECRET', this.config.JWT_REFRESH_SECRET);

      // Validate encryption key format
      if (this.config.ENCRYPTION_KEY && !this.isValidEncryptionKey(this.config.ENCRYPTION_KEY)) {
        this.errors.push('ENCRYPTION_KEY must be a valid 64-character hexadecimal string');
      }

      // Validate JWT secret strength
      if (this.config.JWT_SECRET.length < 32) {
        this.errors.push('JWT_SECRET must be at least 32 characters long in production');
      }
    }

    // Log warnings for missing optional services
    if (!this.config.REDIS_URL && this.config.NODE_ENV === 'production') {
      logger.warn('REDIS_URL not configured - distributed caching will not be available');
    }

    if (!this.config.SMTP_HOST && this.config.NODE_ENV === 'production') {
      logger.warn('SMTP_HOST not configured - email functionality will be limited');
    }
  }

  private validateRequired(name: string, value: string | undefined): void {
    if (!value || value.trim() === '') {
      this.errors.push(`${name} environment variable is required`);
    }
  }

  private isValidEncryptionKey(key: string): boolean {
    return /^[a-f0-9]{64}$/i.test(key);
  }

  public isValid(): boolean {
    return this.errors.length === 0;
  }

  public getErrors(): string[] {
    return [...this.errors];
  }

  public getConfig(): EnvConfig {
    return { ...this.config };
  }

  public logValidationResults(): void {
    if (this.isValid()) {
      logger.info('Environment configuration validation passed', {
        environment: this.config.NODE_ENV,
        hasRedis: !!this.config.REDIS_URL,
        hasSmtp: !!this.config.SMTP_HOST,
        hasSms: !!this.config.SMS_PROVIDER,
      });
    } else {
      logger.error('Environment configuration validation failed', {
        errors: this.errors,
        environment: this.config.NODE_ENV,
      });
      throw new Error(`Environment validation failed: ${this.errors.join(', ')}`);
    }
  }
}

// Singleton instance
let envValidator: EnvironmentValidator | null = null;

export function getEnvValidator(): EnvironmentValidator {
  if (!envValidator) {
    envValidator = new EnvironmentValidator();
  }
  return envValidator;
}

export function validateEnvironment(): void {
  getEnvValidator().logValidationResults();
}

export function getEnvConfig(): EnvConfig {
  return getEnvValidator().getConfig();
}

// Export for direct use
export { EnvironmentValidator };
export type { EnvConfig };