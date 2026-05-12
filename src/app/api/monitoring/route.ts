// Monitoring and Metrics API Routes
// REST API endpoints for system monitoring and metrics

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { tenantPerformanceService } from '@/services/tenant-performance-service';
import { brandingCacheService } from '@/services/branding-cache-service';
import { domainSecurityService } from '@/services/domain-security-service';
import { withErrorHandler, withRateLimit, AuthenticationError, AuthorizationError } from '@/lib/api-error-handler';

// GET /api/monitoring/health - System health check
const healthCheckHandler = async (request: NextRequest) => {
  // Basic health check - no auth required for monitoring
  const health = await tenantPerformanceService.healthCheck();

  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ...health,
  });
};

// GET /api/monitoring/metrics - System metrics (admin only)
const metricsHandler = async (request: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check if user is admin
  // if (!await isAdmin(session.user.id)) {
  //   throw new AuthorizationError();
  // }

  const tenantMetrics = await tenantPerformanceService.getAllTenantPerformance();
  const cacheStats = brandingCacheService.getCacheStats();
  const securityStats = domainSecurityService.getSecurityMetrics();

  return Response.json({
    timestamp: new Date().toISOString(),
    tenants: {
      total: tenantMetrics.quotas.length,
      metrics: tenantMetrics.metrics,
      alerts: tenantMetrics.alerts,
    },
    cache: cacheStats,
    security: securityStats,
    system: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
    },
  });
};

// GET /api/monitoring/branding - Branding performance metrics
const brandingMetricsHandler = async (request: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check if user is admin

  const cacheStats = brandingCacheService.getCacheStats();

  return Response.json({
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    // TODO: Add more branding-specific metrics
  });
};

// POST /api/monitoring/webhook - Webhook for external monitoring services
const webhookHandler = async (request: NextRequest) => {
  // TODO: Add webhook signature verification
  const body = await request.json();

  // Log webhook events
  console.log('Monitoring webhook received:', {
    timestamp: new Date().toISOString(),
    body,
  });

  return Response.json({ received: true });
};

// Apply middleware
export const GET = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 100 })(
    async (request: NextRequest) => {
      const url = new URL(request.url);

      if (url.pathname.endsWith('/health')) {
        return healthCheckHandler(request);
      } else if (url.pathname.endsWith('/metrics')) {
        return metricsHandler(request);
      } else if (url.pathname.endsWith('/branding')) {
        return brandingMetricsHandler(request);
      }

      return Response.json({ error: 'Endpoint not found' }, { status: 404 });
    }
  )
);

export const POST = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 50 })(
    async (request: NextRequest) => {
      const url = new URL(request.url);

      if (url.pathname.endsWith('/webhook')) {
        return webhookHandler(request);
      }

      return Response.json({ error: 'Endpoint not found' }, { status: 404 });
    }
  )
);