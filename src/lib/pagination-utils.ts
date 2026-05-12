/**
 * PAGINATION UTILITIES
 * 
 * Provides consistent pagination handling across all API routes
 * Prevents DoS attacks via large limit values
 * 
 * Created: 2025-10-19 (Deep Dive Audit Fix)
 */

export interface PaginationParams {
  limit: number;
  offset: number;
  page?: number;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultOffset?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;
const DEFAULT_OFFSET = 0;

/**
 * Parse and validate pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
): PaginationParams {
  const {
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = MAX_LIMIT,
    defaultOffset = DEFAULT_OFFSET
  } = options;

  // Parse limit with bounds checking
  const limitParam = searchParams.get('limit');
  let limit = defaultLimit;
  
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && isFinite(parsed)) {
      // Enforce minimum and maximum
      limit = Math.max(MIN_LIMIT, Math.min(parsed, maxLimit));
    }
  }

  // Parse offset with bounds checking
  const offsetParam = searchParams.get('offset');
  let offset = defaultOffset;
  
  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10);
    if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  // Also support page-based pagination
  const pageParam = searchParams.get('page');
  if (pageParam) {
    const parsed = parseInt(pageParam, 10);
    if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
      offset = (parsed - 1) * limit;
    }
  }

  return {
    limit,
    offset,
    page: Math.floor(offset / limit) + 1
  };
}

/**
 * Calculate pagination metadata for response
 */
export function calculatePaginationMeta(
  total: number,
  limit: number,
  offset: number
): {
  total: number;
  limit: number;
  offset: number;
  page: number;
  pageCount: number;
  hasMore: boolean;
  hasPrevious: boolean;
} {
  const pageCount = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return {
    total,
    limit,
    offset,
    page: currentPage,
    pageCount,
    hasMore: offset + limit < total,
    hasPrevious: offset > 0
  };
}

/**
 * Safe integer parsing with bounds
 */
export function safeParseInt(
  value: string | null | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  let result = parsed;
  
  if (min !== undefined) {
    result = Math.max(min, result);
  }
  
  if (max !== undefined) {
    result = Math.min(max, result);
  }

  return result;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: {
  limit?: number;
  offset?: number;
  page?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.limit !== undefined) {
    if (params.limit < MIN_LIMIT) {
      errors.push(`Limit must be at least ${MIN_LIMIT}`);
    }
    if (params.limit > MAX_LIMIT) {
      errors.push(`Limit cannot exceed ${MAX_LIMIT}`);
    }
  }

  if (params.offset !== undefined && params.offset < 0) {
    errors.push('Offset cannot be negative');
  }

  if (params.page !== undefined && params.page < 1) {
    errors.push('Page must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create SQL LIMIT/OFFSET clause safely
 */
export function createLimitOffset(limit: number, offset: number): string {
  const safeLimit = Math.max(MIN_LIMIT, Math.min(limit, MAX_LIMIT));
  const safeOffset = Math.max(0, offset);
  
  return `LIMIT ${safeLimit} OFFSET ${safeOffset}`;
}

/**
 * Constants for easy import
 */
export const PAGINATION_CONSTANTS = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  DEFAULT_OFFSET
} as const;