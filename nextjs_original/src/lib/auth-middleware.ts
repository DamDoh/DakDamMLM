import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    memberId?: string;
    fullName: string;
    isAdmin: boolean;
    accountType: string;
  };
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedRequest> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const user = verifyToken(token);

  if (!user) {
    throw new Error('Invalid or expired token');
  }

  (request as AuthenticatedRequest).user = {
    ...user,
    fullName: user.fullName || user.email || 'User',
    accountType: user.accountType || 'Customer',
  };
  return request as AuthenticatedRequest;
}

export function requireAuth(handler: (request: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const authenticatedRequest = await authenticateRequest(request);
      return handler(authenticatedRequest);
    } catch (error) {
      return NextResponse.json(
        { error: 'Authentication required' },
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
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }

      return handler(authenticatedRequest);
    } catch (error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
  };
}

export function requireSuperAdmin(handler: (request: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const authenticatedRequest = await authenticateRequest(request);

      // Check if user is super admin (specific email from environment variable)
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      if (!superAdminEmail) {
        return NextResponse.json(
          { error: 'Super admin configuration error' },
          { status: 500 }
        );
      }
      if (!authenticatedRequest.user?.isAdmin || authenticatedRequest.user.email !== superAdminEmail) {
        return NextResponse.json(
          { error: 'Super admin access required' },
          { status: 403 }
        );
      }

      return handler(authenticatedRequest);
    } catch (error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
  };
}