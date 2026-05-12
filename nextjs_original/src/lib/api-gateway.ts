// API Gateway Pattern Implementation
// Provides unified API entry point with rate limiting, authentication, and routing

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { RateLimitUtils } from '../../services/shared/utils';

export interface GatewayConfig {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    enabled: boolean;
    origins: string[];
  };
  auth: {
    required: boolean;
    bypassPaths: string[];
  };
}

export class ApiGateway {
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  // Main gateway handler
  async handleRequest(request: NextRequest): Promise<NextResponse> {
    const startTime = performance.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Add request ID to headers for tracing
      const headers = new Headers(request.headers);
      headers.set('x-request-id', requestId);

      // Handle CORS
      if (this.config.cors.enabled) {
        const response = await this.handleCors(request);
        if (response) return response;
      }

      // Rate limiting
      const rateLimitResult = await this.checkRateLimit(request);
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', requestId },
          { status: 429 }
        );
      }

      // Authentication (if required)
      if (this.config.auth.required && !this.config.auth.bypassPaths.includes(request.nextUrl.pathname)) {
        const authResult = await this.authenticateRequest(request);
        if (!authResult.success) {
          return NextResponse.json(
            { error: authResult.error || 'Unauthorized', requestId },
            { status: 401 }
          );
        }
        headers.set('x-user-id', authResult.userId || '');
      }

      // Route to appropriate service
      const response = await this.routeToService(request, headers);

      // Add performance metrics
      const processingTime = performance.now() - startTime;
      response.headers.set('x-processing-time', `${processingTime}ms`);
      response.headers.set('x-request-id', requestId);

      return response;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error(`API Gateway error for ${requestId}:`, error);

      return NextResponse.json(
        {
          error: 'Internal server error',
          requestId,
          processingTime: `${processingTime}ms`
        },
        { status: 500 }
      );
    }
  }

  // CORS handling
  private async handleCors(request: NextRequest): Promise<NextResponse | null> {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': this.config.cors.origins.includes(origin || '') ? origin || '' : '',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    return null;
  }

  // Rate limiting check
  private async checkRateLimit(request: NextRequest): Promise<{ allowed: boolean; remaining: number }> {
    const clientId = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown';

    return RateLimitUtils.checkLimit(
      `gateway-${clientId}`,
      this.config.rateLimit.maxRequests,
      this.config.rateLimit.windowMs / 1000
    );
  }

  // Authentication check
  private async authenticateRequest(request: NextRequest): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const authHeader = request.headers.get('authorization');

      if (!authHeader?.startsWith('Bearer ')) {
        return { success: false, error: 'Missing authorization header' };
      }

      const token = authHeader.substring(7);
      const user = verifyToken(token);

      if (!user) {
        return { success: false, error: 'Invalid token' };
      }

      return { success: true, userId: user.id };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Route to appropriate service
  private async routeToService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;

    // Route to different services based on path
    if (pathname.startsWith('/api/auth/')) {
      return this.routeToAuthService(request, headers);
    } else if (pathname.startsWith('/api/analytics/')) {
      return this.routeToAnalyticsService(request, headers);
    } else if (pathname.startsWith('/api/genealogy/')) {
      return this.routeToGenealogyService(request, headers);
    } else if (pathname.startsWith('/api/commissions/')) {
      return this.routeToCommissionService(request, headers);
    } else if (pathname.startsWith('/api/notifications/')) {
      return this.routeToNotificationService(request, headers);
    } else if (pathname.startsWith('/api/health')) {
      return this.routeToHealthService(request, headers);
    }

    // Default response for unmatched routes
    return NextResponse.json(
      { error: 'Route not found', requestId: headers.get('x-request-id') },
      { status: 404 }
    );
  }

  // Service routing methods
  private async routeToAuthService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    // Route authentication requests to auth service
    const authResponse = await fetch(`${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}${request.nextUrl.pathname}`, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    return new NextResponse(authResponse.body, {
      status: authResponse.status,
      headers: authResponse.headers,
    });
  }

  private async routeToAnalyticsService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    // Route analytics requests to analytics service
    const analyticsResponse = await fetch(`${process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3002'}${request.nextUrl.pathname}`, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    return new NextResponse(analyticsResponse.body, {
      status: analyticsResponse.status,
      headers: analyticsResponse.headers,
    });
  }

  private async routeToGenealogyService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    // Route genealogy requests to genealogy service
    const genealogyResponse = await fetch(`${process.env.GENEALOGY_SERVICE_URL || 'http://localhost:3003'}${request.nextUrl.pathname}`, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    return new NextResponse(genealogyResponse.body, {
      status: genealogyResponse.status,
      headers: genealogyResponse.headers,
    });
  }

  private async routeToCommissionService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    // Route commission requests to commission service
    const commissionResponse = await fetch(`${process.env.COMMISSION_SERVICE_URL || 'http://localhost:3004'}${request.nextUrl.pathname}`, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    return new NextResponse(commissionResponse.body, {
      status: commissionResponse.status,
      headers: commissionResponse.headers,
    });
  }

  private async routeToNotificationService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    // Route notification requests to notification service
    const notificationResponse = await fetch(`${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'}${request.nextUrl.pathname}`, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    return new NextResponse(notificationResponse.body, {
      status: notificationResponse.status,
      headers: notificationResponse.headers,
    });
  }

  private async routeToHealthService(request: NextRequest, headers: Headers): Promise<NextResponse> {
    // Health check endpoint
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        auth: await this.checkServiceHealth('http://localhost:3001/health'),
        analytics: await this.checkServiceHealth('http://localhost:3002/health'),
        genealogy: await this.checkServiceHealth('http://localhost:3003/health'),
        commission: await this.checkServiceHealth('http://localhost:3004/health'),
        notification: await this.checkServiceHealth('http://localhost:3005/health'),
      },
    };

    return NextResponse.json({
      success: true,
      data: health,
      message: 'Health check completed',
      timestamp: new Date().toISOString(),
      requestId: headers.get('x-request-id') || '',
      processingTime: 0,
    });
  }

  // Check individual service health
  private async checkServiceHealth(url: string): Promise<'healthy' | 'unhealthy'> {
    try {
      const response = await fetch(url, { timeout: 5000 } as any);
      return response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      return 'unhealthy';
    }
  }
}

// Default gateway configuration
export const defaultGatewayConfig: GatewayConfig = {
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  cors: {
    enabled: true,
    origins: process.env.NODE_ENV === 'production'
      ? ['https://yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
  },
  auth: {
    required: false, // Set to true for protected routes
    bypassPaths: ['/api/auth/login', '/api/auth/register', '/api/health'],
  },
};

// Create gateway instance
export const apiGateway = new ApiGateway(defaultGatewayConfig);