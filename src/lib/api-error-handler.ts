// API Error Handling Middleware
// Comprehensive error handling for all API routes

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Error response formatter
function formatError(error: any, requestId: string): APIError {
  const timestamp = new Date().toISOString();

  if (error instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
      timestamp,
      requestId,
    };
  }

  if (error instanceof ValidationError) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.details,
      timestamp,
      requestId,
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message: error.message,
      timestamp,
      requestId,
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      code: 'AUTHORIZATION_ERROR',
      message: error.message,
      timestamp,
      requestId,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: error.message,
      timestamp,
      requestId,
    };
  }

  if (error instanceof ConflictError) {
    return {
      code: 'CONFLICT',
      message: error.message,
      timestamp,
      requestId,
    };
  }

  if (error instanceof RateLimitError) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: error.message,
      timestamp,
      requestId,
    };
  }

  // Database connection errors
  if (error?.code === 'P1001' || error?.code === 'P1008') {
    return {
      code: 'DATABASE_CONNECTION_ERROR',
      message: 'Database connection failed',
      timestamp,
      requestId,
    };
  }

  // Prisma unique constraint violations
  if (error?.code === 'P2002') {
    return {
      code: 'DUPLICATE_ENTRY',
      message: 'Resource already exists',
      details: { field: error.meta?.target },
      timestamp,
      requestId,
    };
  }

  // Prisma foreign key constraint violations
  if (error?.code === 'P2003') {
    return {
      code: 'FOREIGN_KEY_CONSTRAINT',
      message: 'Related resource not found',
      timestamp,
      requestId,
    };
  }

  // Default error
  console.error('Unhandled API error:', error);
  return {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp,
    requestId,
  };
}

// Error response generator
function createErrorResponse(error: any, statusCode: number, requestId: string): NextResponse {
  const formattedError = formatError(error, requestId);

  // Log error for monitoring
  console.error(`[${statusCode}] ${formattedError.code}: ${formattedError.message}`, {
    requestId,
    details: formattedError.details,
    stack: error?.stack,
  });

  return NextResponse.json(
    { error: formattedError },
    {
      status: statusCode,
      headers: {
        'X-Request-ID': requestId,
        'X-Error-Code': formattedError.code,
      },
    }
  );
}

// Request ID generator
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Error handling wrapper for API routes
export function withErrorHandler(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    const requestId = generateRequestId();

    try {
      // Add request ID to request for logging
      (request as any).requestId = requestId;

      const response = await handler(request, context);

      // Add request ID to successful responses
      if (response instanceof NextResponse) {
        response.headers.set('X-Request-ID', requestId);
      }

      return response;
    } catch (error) {
      // Determine status code based on error type
      let statusCode = 500;

      if (error instanceof ValidationError || error instanceof ZodError) {
        statusCode = 400;
      } else if (error instanceof AuthenticationError) {
        statusCode = 401;
      } else if (error instanceof AuthorizationError) {
        statusCode = 403;
      } else if (error instanceof NotFoundError) {
        statusCode = 404;
      } else if (error instanceof ConflictError) {
        statusCode = 409;
      } else if (error instanceof RateLimitError) {
        statusCode = 429;
      }

      return createErrorResponse(error, statusCode, requestId);
    }
  };
}

// Validation middleware
export function validateRequest(schema: any) {
  return (handler: Function) => {
    return async (request: NextRequest, context?: any) => {
      try {
        const body = request.method !== 'GET' ? await request.json() : {};
        const query = Object.fromEntries(request.nextUrl.searchParams);
        const params = context?.params || {};

        const data = { ...body, ...query, ...params };
        const validation = schema.safeParse(data);

        if (!validation.success) {
          throw new ValidationError('Request validation failed', validation.error.errors);
        }

        // Add validated data to request
        (request as any).validatedData = validation.data;

        return handler(request, context);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError('Invalid request format');
      }
    };
  };
}

// Rate limiting middleware
export function withRateLimit(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (handler: Function) => {
    return async (request: NextRequest, context?: any) => {
      const key = options.keyGenerator?.(request) ||
                  request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'anonymous';

      const now = Date.now();
      const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
      const resetTime = windowStart + options.windowMs;

      const current = requests.get(key) || { count: 0, resetTime };

      if (current.resetTime !== resetTime) {
        // Reset window
        current.count = 0;
        current.resetTime = resetTime;
      }

      current.count++;
      requests.set(key, current);

      if (current.count > options.maxRequests) {
        throw new RateLimitError(`Rate limit exceeded. Try again in ${Math.ceil((resetTime - now) / 1000)} seconds`);
      }

      const response = await handler(request, context);

      if (response instanceof NextResponse) {
        response.headers.set('X-RateLimit-Limit', options.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', Math.max(0, options.maxRequests - current.count).toString());
        response.headers.set('X-RateLimit-Reset', resetTime.toString());
      }

      return response;
    };
  };
}

// CORS middleware
export function withCORS(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const response = await handler(request, context);

    if (response instanceof NextResponse) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }

    return response;
  };
}