import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { logger } from './logger';

/**
 * CSRF (Cross-Site Request Forgery) Protection
 * 
 * Implements double-submit cookie pattern for CSRF protection.
 * Required for production security.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface CSRFTokenData {
  token: string;
  createdAt: number;
}

// In-memory token store (for production, use Redis)
class CSRFTokenStore {
  private tokens = new Map<string, CSRFTokenData>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  set(token: string, data: CSRFTokenData): void {
    this.tokens.set(token, data);
  }

  get(token: string): CSRFTokenData | undefined {
    return this.tokens.get(token);
  }

  delete(token: string): void {
    this.tokens.delete(token);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [token, data] of this.tokens.entries()) {
      if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
        this.tokens.delete(token);
      }
    }
    logger.debug(`CSRF token store cleanup: ${this.tokens.size} tokens remaining`);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tokens.clear();
  }
}

const csrfTokenStore = new CSRFTokenStore();

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Hash CSRF token for secure storage/comparison
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create CSRF token and set cookie
 */
export function createCSRFToken(response: NextResponse): string {
  const token = generateCSRFToken();
  const hashedToken = hashToken(token);

  // Store token with timestamp
  csrfTokenStore.set(hashedToken, {
    token: hashedToken,
    createdAt: Date.now()
  });

  // Set cookie with secure flags
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000, // Convert to seconds
    path: '/'
  });

  return token;
}

/**
 * Validate CSRF token from request
 */
export function validateCSRFToken(request: NextRequest): boolean {
  try {
    // Get token from cookie
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!cookieToken) {
      logger.warn('CSRF validation failed: No cookie token', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return false;
    }

    // Get token from header
    const headerToken = request.headers.get(CSRF_HEADER_NAME);
    if (!headerToken) {
      logger.warn('CSRF validation failed: No header token', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return false;
    }

    // Tokens must match (double-submit pattern)
    if (cookieToken !== headerToken) {
      logger.warn('CSRF validation failed: Token mismatch', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return false;
    }

    // Verify token exists in store and hasn't expired
    const hashedToken = hashToken(cookieToken);
    const tokenData = csrfTokenStore.get(hashedToken);

    if (!tokenData) {
      logger.warn('CSRF validation failed: Token not found in store', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return false;
    }

    // Check if token expired
    if (Date.now() - tokenData.createdAt > CSRF_TOKEN_EXPIRY) {
      csrfTokenStore.delete(hashedToken);
      logger.warn('CSRF validation failed: Token expired', {
        url: request.url,
        age: Date.now() - tokenData.createdAt,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('CSRF validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: request.url
    }, request);
    return false;
  }
}

/**
 * CSRF protection middleware for API routes
 * Only validates state-changing methods (POST, PUT, DELETE, PATCH)
 */
export function withCSRFProtection(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Only check CSRF for state-changing methods
    const methodsToProtect = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (!methodsToProtect.includes(request.method)) {
      // GET, HEAD, OPTIONS don't need CSRF protection
      return handler(request, context);
    }

    // Validate CSRF token
    const isValid = validateCSRFToken(request);

    if (!isValid) {
      logger.security('CSRF attack attempt blocked', undefined, {
        method: request.method,
        url: request.url,
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);

      return NextResponse.json(
        { error: 'CSRF token validation failed' },
        { status: 403 }
      );
    }

    // CSRF validated, proceed with handler
    return handler(request, context);
  };
}

/**
 * API endpoint to get CSRF token (for client-side forms)
 */
export async function getCSRFToken(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.json({
    success: true,
    token: generateCSRFToken()
  });

  return response;
}

/**
 * Cleanup function for graceful shutdown
 */
export function cleanupCSRFStore(): void {
  csrfTokenStore.destroy();
  logger.info('CSRF token store cleaned up');
}

/**
 * Get CSRF protection statistics
 */
export function getCSRFStats(): {
  activeTokens: number;
} {
  return {
    activeTokens: csrfTokenStore['tokens'].size
  };
}

/**
 * Helper to check if route should skip CSRF (e.g., webhooks, health checks)
 */
export function shouldSkipCSRF(request: NextRequest): boolean {
  const path = new URL(request.url).pathname;

  // Routes that should skip CSRF validation
  const skipRoutes = [
    '/api/health',
    '/api/webhook',
    '/api/csrf-token', // The token endpoint itself
  ];

  return skipRoutes.some(route => path.startsWith(route));
}

/**
 * Enhanced CSRF middleware with skip logic
 */
export function withCSRFProtectionEnhanced(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Skip CSRF for certain routes
    if (shouldSkipCSRF(request)) {
      return handler(request, context);
    }

    // Apply standard CSRF protection
    return withCSRFProtection(handler)(request, context);
  };
}