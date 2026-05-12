/**
 * CONSOLIDATED AUTH SERVICE
 *
 * This file now serves as a re-export wrapper to avoid duplication.
 * All authentication logic is centralized in services/auth-service/index.ts
 *
 * This approach:
 * - Eliminates 90% code duplication
 * - Maintains backward compatibility for imports
 * - Provides single source of truth
 * - Uses the more complete services implementation
 */

// Re-export all types and functions from the centralized auth service
export {
  // Types
  type AuthUser,
  type LoginCredentials,
  type RegisterData,
  type AuthTokens,
  
  // Core functions
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
  loginUser,
  registerUser,
  changePassword,
  getUserById,
  refreshToken,
  
  // Validation utilities (now in services)
  // Note: validateEmail and validatePhoneNumber are in ValidationUtils
  
  // Health check
  healthCheck,
} from '../../services/auth-service/index';

// For backward compatibility, provide validation functions
import { ValidationUtils } from '../../services/shared/utils';

export function validateEmail(email: string): boolean {
  return ValidationUtils.isValidEmail(email);
}

export function validatePhoneNumber(phoneNumber: string): boolean {
  return ValidationUtils.isValidPhoneNumber(phoneNumber);
}

// Custom error classes for this module (maintain compatibility)
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Note: JWT secret validation is now handled by services/auth-service
// It will throw on startup if JWT_SECRET is not set
