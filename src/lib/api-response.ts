// Standardized API Response Utility
// Provides consistent response formats across all API endpoints

import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  total?: number;
}

export class ApiResponseUtil {
  private static readonly API_VERSION = '1.0';

  /**
   * Create a successful API response
   */
  static success<T>(
    data: T,
    message?: string,
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  ): NextResponse {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      pagination,
      meta: {
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
      }
    };

    return NextResponse.json(response);
  }

  /**
   * Create a paginated API response
   */
  static paginated<T>(
    data: T[],
    total: number,
    limit: number,
    offset: number,
    message?: string
  ): NextResponse {
    const pagination = {
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrev: offset > 0
    };

    return this.success(data, message, pagination);
  }

  /**
   * Create an error API response
   */
  static error(
    error: string,
    status: number = 500,
    details?: any
  ): NextResponse {
    const response: ApiResponse = {
      success: false,
      error,
      details,
      meta: {
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
      }
    };

    return NextResponse.json(response, { status });
  }

  /**
   * Create a validation error response
   */
  static validationError(details: any): NextResponse {
    return this.error('Validation failed', 400, details);
  }

  /**
   * Create an authentication error response
   */
  static unauthorized(message: string = 'Authentication required'): NextResponse {
    return this.error(message, 401);
  }

  /**
   * Create a forbidden error response
   */
  static forbidden(message: string = 'Access denied'): NextResponse {
    return this.error(message, 403);
  }

  /**
   * Create a not found error response
   */
  static notFound(resource: string = 'Resource'): NextResponse {
    return this.error(`${resource} not found`, 404);
  }

  /**
   * Create a rate limit error response
   */
  static rateLimit(retryAfter?: number): NextResponse {
    const response = this.error('Rate limit exceeded', 429);

    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
  }

  /**
   * Create a service unavailable error response
   */
  static serviceUnavailable(details?: string): NextResponse {
    return this.error('Service temporarily unavailable', 503, details);
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(limit?: string | number, offset?: string | number) {
    const limitNum = Math.min(parseInt(limit?.toString() || '50'), 200); // Max 200
    const offsetNum = Math.max(parseInt(offset?.toString() || '0'), 0);

    return {
      limit: limitNum,
      offset: offsetNum
    };
  }

  /**
   * Validate query parameters for common patterns
   */
  static validateQueryParams(params: Record<string, string | undefined>, validValues?: Record<string, string[]>) {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        // Check against valid values if provided
        if (validValues?.[key] && !validValues[key].includes(value)) {
          errors.push(`Invalid value for ${key}: ${value}`);
        }
      }
    }

    return errors;
  }
}

/**
 * Common validation patterns for API endpoints
 */
export const VALIDATION_PATTERNS = {
  // Status values for various entities
  statuses: {
    stockRequest: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    ecashTopup: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    order: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    user: ['ACTIVE', 'INACTIVE', 'SUSPENDED']
  },

  // Categories for business rules
  ruleCategories: ['commission', 'bonus', 'qualification', 'maintenance', 'incentive', 'penalty'],

  // Types for business rules
  ruleTypes: [
    'binary_bonus', 'matching_bonus', 'stockist_bonus', 'rank_achievement_bonus',
    'leadership_bonus', 'pool_bonus', 'fast_start_bonus', 'retail_profit'
  ],

  // Stockist levels
  stockistLevels: ['S', 'M', 'C', 'D'],

  // Account types
  accountTypes: ['Customer', 'Distributor'],

  // Ranks
  ranks: [
    'Member', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Super Diamond',
    'Half STAR', 'STAR', 'Supervisor', 'Manager', 'Director',
    'President', 'Chairman', 'Blue Diamond', 'Black Diamond',
    'Emerald', 'Blue Emerald', 'Elite', 'Crown', 'Double Diamond', 'Expired'
  ]
};

/**
 * Common API response messages
 */
export const API_MESSAGES = {
  // Success messages
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  FETCHED: 'Data retrieved successfully',

  // Error messages
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  VALIDATION_FAILED: 'Validation failed',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  SERVER_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',

  // Specific messages
  STOCK_REQUEST_CREATED: 'Stock request submitted successfully',
  ECASH_TOPUP_CREATED: 'eCash topup request submitted successfully',
  BUSINESS_RULE_CREATED: 'Business rule created successfully',
  COMPANY_CREATED: 'Company registration submitted successfully'
} as const;