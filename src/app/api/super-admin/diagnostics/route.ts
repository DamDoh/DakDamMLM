import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import os from 'os';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  return requireSuperAdmin(async (authenticatedRequest) => {
    try {
      // Apply rate limiting
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
      if (!rateLimitResult.success) {
        logger.warn('Rate limit exceeded for system diagnostics', {
          ip: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent')
        }, request);
        return rateLimitResult.response!;
      }

      // System metrics
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);

      const cpus = os.cpus();
      const cpuUsagePercent = Math.round(Math.random() * 30 + 40); // Mock CPU usage (40-70%)
      
      const diskUsagePercent = Math.round(Math.random() * 20 + 20); // Mock disk usage (20-40%)

      // Calculate uptime
      const uptimeSeconds = os.uptime();
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const uptime = `${days}d ${hours}h ${minutes}m`;

      // Check database connection
      let dbStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      let dbMessage = 'Database connection is healthy';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        dbStatus = 'error';
        dbMessage = 'Database connection failed';
        logger.error('Database connection check failed', { error }, request);
      }

      // Check user service (count active users)
      let userServiceStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      let userServiceMessage = 'User service is operational';
      let userCount = 0;
      try {
        userCount = await prisma.user.count({ where: { active: true } });
        if (userCount === 0) {
          userServiceStatus = 'warning';
          userServiceMessage = 'No active users found';
        }
      } catch (error) {
        userServiceStatus = 'error';
        userServiceMessage = 'Failed to query users';
        logger.error('User service check failed', { error }, request);
      }

      // Check company service
      let companyServiceStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      let companyServiceMessage = 'Company service is operational';
      try {
        const companyCount = await prisma.company.count({ where: { isActive: true } });
        if (companyCount === 0) {
          companyServiceStatus = 'warning';
          companyServiceMessage = 'No active companies found';
        }
      } catch (error) {
        companyServiceStatus = 'error';
        companyServiceMessage = 'Failed to query companies';
        logger.error('Company service check failed', { error }, request);
      }

      // Determine overall status
      const services = [
        { service: 'Database', status: dbStatus, message: dbMessage },
        { service: 'User Service', status: userServiceStatus, message: userServiceMessage },
        { service: 'Company Service', status: companyServiceStatus, message: companyServiceMessage },
      ];

      const hasError = services.some(s => s.status === 'error');
      const hasWarning = services.some(s => s.status === 'warning');
      const overall = hasError ? 'error' : hasWarning ? 'warning' : 'healthy';

      // Generate alerts if needed
      const alerts: Array<{
        id: string;
        severity: 'warning' | 'error';
        message: string;
        timestamp: string;
      }> = [];

      if (memoryUsagePercent > 80) {
        alerts.push({
          id: 'memory-high',
          severity: 'warning',
          message: `High memory usage: ${memoryUsagePercent}%`,
          timestamp: new Date().toISOString(),
        });
      }

      if (cpuUsagePercent > 80) {
        alerts.push({
          id: 'cpu-high',
          severity: 'warning',
          message: `High CPU usage: ${cpuUsagePercent}%`,
          timestamp: new Date().toISOString(),
        });
      }

      if (dbStatus === 'error') {
        alerts.push({
          id: 'db-error',
          severity: 'error',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
        });
      }

      const diagnostics = {
        overall,
        services,
        metrics: {
          uptime,
          cpu: cpuUsagePercent,
          memory: memoryUsagePercent,
          disk: diskUsagePercent,
        },
        alerts,
      };

      const duration = Date.now() - startTime;
      logger.info('System diagnostics completed', {
        overall,
        duration,
        userCount,
      }, request);

      return NextResponse.json({
        success: true,
        data: diagnostics,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('System diagnostics error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        ip: request.headers.get('x-forwarded-for')
      }, request);

      if (error instanceof Error && error.message.includes('Authentication')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to run system diagnostics' },
        { status: 500 }
      );
    }
  })(request);
}

