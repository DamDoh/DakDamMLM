// Tenant Performance Management Service
// Handles resource quotas, performance monitoring, and throttling for multi-tenant system

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface TenantQuota {
  companyId: string;
  maxConcurrentUsers: number;
  maxApiCallsPerHour: number;
  maxDatabaseConnections: number;
  maxMemoryUsage: number; // in MB
  maxCpuUsage: number; // percentage
  priority: 'low' | 'medium' | 'high';
}

export interface TenantMetrics {
  companyId: string;
  activeUsers: number;
  apiCallsThisHour: number;
  databaseConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  responseTimeAvg: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface PerformanceAlert {
  companyId: string;
  type: 'quota_exceeded' | 'performance_degraded' | 'resource_limit';
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
}

class TenantPerformanceService {
  private static instance: TenantPerformanceService;
  private metricsCache = new Map<string, TenantMetrics>();
  private quotasCache = new Map<string, TenantQuota>();
  private alertsQueue: PerformanceAlert[] = [];

  private constructor() {
    // Initialize default quotas for all companies
    this.initializeDefaultQuotas();
    // Start monitoring loop
    setInterval(() => this.monitorTenants(), 30000); // Every 30 seconds
  }

  static getInstance(): TenantPerformanceService {
    if (!TenantPerformanceService.instance) {
      TenantPerformanceService.instance = new TenantPerformanceService();
    }
    return TenantPerformanceService.instance;
  }

  // Initialize default quotas for all companies
  private async initializeDefaultQuotas(): Promise<void> {
    try {
      const companies = await prisma.company.findMany({
        select: { id: true, name: true, tier: true }
      });

      for (const company of companies) {
        const quota = this.getDefaultQuotaForTier(company.tier || 'basic');
        this.quotasCache.set(company.id, { ...quota, companyId: company.id });
      }

      logger.info(`Initialized quotas for ${companies.length} companies`);
    } catch (error) {
      logger.error('Failed to initialize tenant quotas:', error);
    }
  }

  // Get default quota based on company tier
  private getDefaultQuotaForTier(tier: string): Omit<TenantQuota, 'companyId'> {
    switch (tier.toLowerCase()) {
      case 'enterprise':
        return {
          maxConcurrentUsers: 1000,
          maxApiCallsPerHour: 100000,
          maxDatabaseConnections: 50,
          maxMemoryUsage: 2048, // 2GB
          maxCpuUsage: 80,
          priority: 'high'
        };
      case 'professional':
        return {
          maxConcurrentUsers: 500,
          maxApiCallsPerHour: 50000,
          maxDatabaseConnections: 25,
          maxMemoryUsage: 1024, // 1GB
          maxCpuUsage: 60,
          priority: 'medium'
        };
      case 'basic':
      default:
        return {
          maxConcurrentUsers: 100,
          maxApiCallsPerHour: 10000,
          maxDatabaseConnections: 10,
          maxMemoryUsage: 512, // 512MB
          maxCpuUsage: 40,
          priority: 'low'
        };
    }
  }

  // Monitor tenant performance
  private async monitorTenants(): Promise<void> {
    try {
      const companies = await prisma.company.findMany({
        select: { id: true, name: true }
      });

      for (const company of companies) {
        await this.updateTenantMetrics(company.id);
        await this.checkQuotaCompliance(company.id);
      }

      // Process alerts
      await this.processAlerts();
    } catch (error) {
      logger.error('Tenant monitoring failed:', error);
    }
  }

  // Update metrics for a specific tenant
  private async updateTenantMetrics(companyId: string): Promise<void> {
    try {
      // Get active sessions for this company
      const activeSessions = await prisma.securitySession.count({
        where: {
          user: { companyId },
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });

      // Get API calls in the last hour (simplified - would need actual API logging)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentApiCalls = await prisma.auditLog.count({
        where: {
          companyId,
          createdAt: { gte: oneHourAgo }
        }
      });

      // Get database connections (simplified)
      const dbConnections = Math.floor(Math.random() * 20) + 5; // Mock data

      // Get resource usage (simplified - would need actual monitoring)
      const memoryUsage = Math.floor(Math.random() * 100) + 50;
      const cpuUsage = Math.floor(Math.random() * 30) + 10;

      // Calculate response time average (simplified)
      const responseTimeAvg = Math.floor(Math.random() * 200) + 100;

      // Calculate error rate (simplified)
      const errorRate = Math.random() * 0.05; // 0-5%

      const metrics: TenantMetrics = {
        companyId,
        activeUsers: activeSessions,
        apiCallsThisHour: recentApiCalls,
        databaseConnections: dbConnections,
        memoryUsage,
        cpuUsage,
        responseTimeAvg,
        errorRate,
        lastUpdated: new Date()
      };

      this.metricsCache.set(companyId, metrics);
    } catch (error) {
      logger.error(`Failed to update metrics for company ${companyId}:`, error);
    }
  }

  // Check if tenant is complying with quotas
  private async checkQuotaCompliance(companyId: string): Promise<void> {
    const quota = this.quotasCache.get(companyId);
    const metrics = this.metricsCache.get(companyId);

    if (!quota || !metrics) return;

    const alerts: PerformanceAlert[] = [];

    // Check concurrent users
    if (metrics.activeUsers > quota.maxConcurrentUsers) {
      alerts.push({
        companyId,
        type: 'quota_exceeded',
        metric: 'concurrent_users',
        currentValue: metrics.activeUsers,
        threshold: quota.maxConcurrentUsers,
        severity: 'critical',
        timestamp: new Date()
      });
    }

    // Check API calls per hour
    if (metrics.apiCallsThisHour > quota.maxApiCallsPerHour) {
      alerts.push({
        companyId,
        type: 'quota_exceeded',
        metric: 'api_calls_per_hour',
        currentValue: metrics.apiCallsThisHour,
        threshold: quota.maxApiCallsPerHour,
        severity: 'warning',
        timestamp: new Date()
      });
    }

    // Check database connections
    if (metrics.databaseConnections > quota.maxDatabaseConnections) {
      alerts.push({
        companyId,
        type: 'resource_limit',
        metric: 'database_connections',
        currentValue: metrics.databaseConnections,
        threshold: quota.maxDatabaseConnections,
        severity: 'warning',
        timestamp: new Date()
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > quota.maxMemoryUsage) {
      alerts.push({
        companyId,
        type: 'resource_limit',
        metric: 'memory_usage',
        currentValue: metrics.memoryUsage,
        threshold: quota.maxMemoryUsage,
        severity: 'critical',
        timestamp: new Date()
      });
    }

    // Check CPU usage
    if (metrics.cpuUsage > quota.maxCpuUsage) {
      alerts.push({
        companyId,
        type: 'performance_degraded',
        metric: 'cpu_usage',
        currentValue: metrics.cpuUsage,
        threshold: quota.maxCpuUsage,
        severity: 'warning',
        timestamp: new Date()
      });
    }

    // Check response time (if > 1000ms, it's degraded)
    if (metrics.responseTimeAvg > 1000) {
      alerts.push({
        companyId,
        type: 'performance_degraded',
        metric: 'response_time',
        currentValue: metrics.responseTimeAvg,
        threshold: 1000,
        severity: 'warning',
        timestamp: new Date()
      });
    }

    // Check error rate (if > 5%, it's critical)
    if (metrics.errorRate > 0.05) {
      alerts.push({
        companyId,
        type: 'performance_degraded',
        metric: 'error_rate',
        currentValue: metrics.errorRate * 100,
        threshold: 5,
        severity: 'critical',
        timestamp: new Date()
      });
    }

    // Add alerts to queue
    this.alertsQueue.push(...alerts);
  }

  // Process queued alerts
  private async processAlerts(): Promise<void> {
    if (this.alertsQueue.length === 0) return;

    const alerts = [...this.alertsQueue];
    this.alertsQueue = [];

    for (const alert of alerts) {
      try {
        // Create notification
        await this.createPerformanceNotification(alert);

        // Apply throttling if necessary
        if (alert.severity === 'critical') {
          await this.applyThrottling(alert.companyId, alert.metric);
        }

        logger.warn('Tenant performance alert', {
          companyId: alert.companyId,
          type: alert.type,
          metric: alert.metric,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          severity: alert.severity
        });
      } catch (error) {
        logger.error('Failed to process performance alert:', error);
      }
    }
  }

  // Create performance notification
  private async createPerformanceNotification(alert: PerformanceAlert): Promise<void> {
    const { notificationService } = await import('./notification-service');

    const title = `Performance Alert: ${alert.metric.replace('_', ' ')}`;
    const message = `${alert.metric.replace('_', ' ')} exceeded threshold. Current: ${alert.currentValue}, Threshold: ${alert.threshold}`;

    await notificationService.createPerformanceAlert(
      title,
      message,
      alert.companyId
    );
  }

  // Apply throttling to tenant
  private async applyThrottling(companyId: string, metric: string): Promise<void> {
    try {
      // In a real implementation, this would modify rate limits, connection pools, etc.
      logger.info(`Applying throttling to company ${companyId} for metric ${metric}`);

      // For now, just log the action
      // In production, this would:
      // 1. Reduce API rate limits
      // 2. Limit database connections
      // 3. Queue requests
      // 4. Send warning emails

    } catch (error) {
      logger.error(`Failed to apply throttling for company ${companyId}:`, error);
    }
  }

  // Get tenant metrics
  async getTenantMetrics(companyId: string): Promise<TenantMetrics | null> {
    return this.metricsCache.get(companyId) || null;
  }

  // Get tenant quota
  async getTenantQuota(companyId: string): Promise<TenantQuota | null> {
    return this.quotasCache.get(companyId) || null;
  }

  // Update tenant quota
  async updateTenantQuota(companyId: string, updates: Partial<TenantQuota>): Promise<void> {
    const existingQuota = this.quotasCache.get(companyId);
    if (existingQuota) {
      this.quotasCache.set(companyId, { ...existingQuota, ...updates });
      logger.info(`Updated quota for company ${companyId}`, updates);
    }
  }

  // Get all tenant performance data
  async getAllTenantPerformance(): Promise<{
    quotas: TenantQuota[];
    metrics: TenantMetrics[];
    alerts: PerformanceAlert[];
  }> {
    return {
      quotas: Array.from(this.quotasCache.values()),
      metrics: Array.from(this.metricsCache.values()),
      alerts: this.alertsQueue
    };
  }

  // Check if request should be throttled
  async shouldThrottleRequest(companyId: string, requestType: 'api' | 'database'): Promise<boolean> {
    const metrics = this.metricsCache.get(companyId);
    const quota = this.quotasCache.get(companyId);

    if (!metrics || !quota) return false;

    switch (requestType) {
      case 'api':
        return metrics.apiCallsThisHour >= quota.maxApiCallsPerHour * 0.9; // 90% threshold
      case 'database':
        return metrics.databaseConnections >= quota.maxDatabaseConnections * 0.9;
      default:
        return false;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; tenants: number; alerts: number }> {
    return {
      status: 'healthy',
      tenants: this.quotasCache.size,
      alerts: this.alertsQueue.length
    };
  }
}

export const tenantPerformanceService = TenantPerformanceService.getInstance();
export default tenantPerformanceService;</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\tenant-performance-service.ts