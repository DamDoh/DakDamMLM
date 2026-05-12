import { Request, Response } from 'express';
import { cacheService } from '../utils/cache';
import { metricsService } from '../utils/metrics';
import { queueService } from '../utils/queue';
import { notificationDb as db } from '../config/database';

export class HealthController {
  healthCheck = async (req: Request, res: Response) => {
    try {
      const checks = await this.performHealthChecks();

      const overallStatus = checks.every(check => check.status === 'healthy') ? 'healthy' : 'degraded';
      const unhealthyChecks = checks.filter(check => check.status !== 'healthy');

      if (overallStatus === 'degraded') {
        (res as any).status(503).json({
          success: false,
          status: overallStatus,
          timestamp: new Date().toISOString(),
          checks,
          issues: unhealthyChecks.map(check => ({
            service: check.service,
            error: check.error || 'Service unavailable'
          }))
        });
      } else {
        (res as any).json({
          success: true,
          status: overallStatus,
          timestamp: new Date().toISOString(),
          checks,
          version: process.env.npm_package_version || '1.0.0',
          uptime: process.uptime()
        });
      }
    } catch (error) {
      (res as any).status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  };

  private async performHealthChecks(): Promise<Array<{
    service: string;
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  }>> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
      this.checkMetrics(),
      this.checkQueue(),
    ]);

    return checks.map((check, index) => {
      const serviceNames = ['database', 'cache', 'metrics', 'queue'];
      const serviceName = serviceNames[index];

      if (check.status === 'fulfilled') {
        return {
          service: serviceName,
          status: check.value.status,
          ...(('latency' in check.value) && { latency: check.value.latency }),
          ...(('queues' in check.value) && { queues: check.value.queues }),
        };
      } else {
        return {
          service: serviceName,
          status: 'unhealthy',
          error: check.reason?.message || 'Check failed',
        };
      }
    });
  }

  private async checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const start = Date.now();
      await db.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  private async checkCache(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const result = await cacheService.healthCheck();
      return { status: result.status as 'healthy' | 'unhealthy', latency: result.latency };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  private async checkMetrics(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const result = await metricsService.healthCheck();
      return { status: result.status as 'healthy' | 'unhealthy' };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  private async checkQueue(): Promise<{ status: 'healthy' | 'unhealthy'; queues?: any }> {
    try {
      const result = await queueService.healthCheck();
      return { status: result.status as 'healthy' | 'unhealthy', queues: result.queues };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}