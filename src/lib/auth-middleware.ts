import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/database';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    memberId?: string;
    fullName?: string;
    isAdmin: boolean;
    accountType?: string;
    companyId?: string;
    storeOwnerLevel?: string | null;
  };
}

/**
 * ENHANCED: Added better error handling and logging
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedRequest> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new AuthenticationError('No authorization header provided');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Invalid authorization format. Expected: Bearer <token>');
  }

  const token = authHeader.substring(7);
  
  if (!token || token.trim() === '') {
    throw new AuthenticationError('Empty authorization token');
  }

  try {
    const user = verifyToken(token);

    if (!user) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // ENHANCEMENT: Validate user object structure
    if (!user.id || !user.email) {
      throw new AuthenticationError('Invalid user data in token');
    }

    // ENHANCEMENT: Validate active user state from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        memberId: true,
        fullName: true,
        isAdmin: true,
        accountType: true,
        companyId: true,
        storeOwnerLevel: true,
        active: true,
        deleted: true
      }
    });

    if (!dbUser || !dbUser.active || dbUser.deleted) {
      throw new AuthenticationError('User account is inactive or deleted');
    }

    // ENHANCEMENT: Keep token payload in sync with current database state
    const authenticatedUser = {
      id: dbUser.id,
      email: dbUser.email,
      memberId: dbUser.memberId,
      fullName: dbUser.fullName,
      isAdmin: dbUser.isAdmin,
      accountType: dbUser.accountType || 'Customer',
      companyId: dbUser.companyId || undefined,
      storeOwnerLevel: dbUser.storeOwnerLevel || null
    };

    if (user.companyId && user.companyId !== authenticatedUser.companyId) {
      console.warn('[Auth Middleware] Token companyId differs from database companyId', {
        tokenCompanyId: user.companyId,
        dbCompanyId: authenticatedUser.companyId,
        userId: user.id
      });
    }

    (request as AuthenticatedRequest).user = authenticatedUser;
    return request as AuthenticatedRequest;
  } catch (error) {
    // ENHANCEMENT: Better error logging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Auth Middleware] Token verification failed:', error);
    }
    
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    throw new AuthenticationError('Token verification failed');
  }
}

export function requireAuth(handler: (request: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const authenticatedRequest = await authenticateRequest(request);
      return handler(authenticatedRequest);
    } catch (error) {
      const message = error instanceof AuthenticationError 
        ? error.message 
        : 'Authentication required';
      
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message,
          // ENHANCEMENT: Add timestamp for debugging
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }
  };
}

export function requireAdmin(handler: (request: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const authenticatedRequest = await authenticateRequest(request);

      if (!authenticatedRequest.user?.isAdmin) {
        // ENHANCEMENT: Log unauthorized admin access attempts
        console.warn('[Security] Unauthorized admin access attempt:', {
          userId: authenticatedRequest.user?.id,
          email: authenticatedRequest.user?.email,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          { 
            error: 'Forbidden',
            message: 'Admin access required' 
          },
          { status: 403 }
        );
      }

      return handler(authenticatedRequest);
    } catch (error) {
      const message = error instanceof AuthenticationError 
        ? error.message 
        : 'Authentication required';
        
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message 
        },
        { status: 401 }
      );
    }
  };
}

export function requireSuperAdmin(handler: (request: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const authenticatedRequest = await authenticateRequest(request);

      if (!authenticatedRequest.user?.isAdmin) {
        console.warn('[Security] Non-admin user attempted super admin access:', {
          userId: authenticatedRequest.user?.id,
          email: authenticatedRequest.user?.email,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          { 
            error: 'Forbidden',
            message: 'Admin access required' 
          },
          { status: 403 }
        );
      }

      // ENHANCEMENT: Load detailed SuperAdminUser profile for richer permissions
      const superAdminProfile = await prisma.superAdminUser.findUnique({
        where: { userId: authenticatedRequest.user.id },
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      });

      // Attach superAdminProfile to request (may be undefined if user isn't yet in SuperAdminUser table)
      (authenticatedRequest as any).superAdminProfile = superAdminProfile;

      // Additional check: if SUPER_ADMIN_EMAIL is configured, enforce whitelist
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      
      if (superAdminEmail && superAdminEmail.trim() !== '') {
        const userEmail = authenticatedRequest.user?.email?.toLowerCase().trim();
        const configuredEmail = superAdminEmail.toLowerCase().trim();

        if (userEmail !== configuredEmail) {
          console.warn('[Security] Unauthorized super admin access attempt:', {
            userId: authenticatedRequest.user?.id,
            email: authenticatedRequest.user?.email,
            isAdmin: authenticatedRequest.user?.isAdmin,
            configuredEmail: configuredEmail,
            timestamp: new Date().toISOString()
          });

          return NextResponse.json(
            { 
              error: 'Forbidden',
              message: 'Super admin access required. Your email does not match the configured super admin email.' 
            },
            { status: 403 }
          );
        }
      }

      return handler(authenticatedRequest);
    } catch (error) {
      const message = error instanceof AuthenticationError 
        ? error.message 
        : 'Authentication required';
      
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message 
        },
        { status: 401 }
      );
    }
  };
}

/**
 * ENHANCEMENT: Custom error class for better error handling
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * ENHANCEMENT: Rate limiting helper
 * Usage: Add this middleware before authentication in high-traffic endpoints
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest): Promise<NextResponse> => {
      const identifier = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
      
      const now = Date.now();
      const record = rateLimitMap.get(identifier);

      if (record) {
        if (now < record.resetTime) {
          if (record.count >= maxRequests) {
            return NextResponse.json(
              { 
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil((record.resetTime - now) / 1000)
              },
              { 
                status: 429,
                headers: {
                  'Retry-After': String(Math.ceil((record.resetTime - now) / 1000))
                }
              }
            );
          }
          record.count++;
        } else {
          // Reset window
          record.count = 1;
          record.resetTime = now + windowMs;
        }
      } else {
        rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      }

      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance
        const cutoff = now - windowMs;
        for (const [key, value] of rateLimitMap.entries()) {
          if (value.resetTime < cutoff) {
            rateLimitMap.delete(key);
          }
        }
      }

      return handler(request);
    };
  };
}
