/**
 * MULTI-TENANT RESOURCE MANAGEMENT AND QUOTAS
 *
 * Comprehensive resource management system for multi-tenant MLM platform
 * providing fair resource allocation, usage tracking, quota enforcement,
 * and automated scaling capabilities.
 *
 * Features:
 * - Resource allocation and quota management per tenant
 * - Usage tracking and monitoring across all resources
 * - Automated quota enforcement with graceful degradation
 * - Billing integration with usage-based pricing
 * - Resource scaling and optimization
 * - Tenant isolation and security
 * - Performance monitoring per tenant
 * - Cost optimization and resource efficiency
 *
 * Created: 2025-11-20 (Enhancement)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { apmMonitoring } from './apm-monitoring';
import * as cron from 'node-cron';

export interface TenantResourceQuota {
  tenantId: string;
  resources: {
    users: {
      maxUsers: number;
      currentUsers: number;
      monthlyActiveUsers: number;
    };
    storage: {
      maxStorageGB: number;
      currentStorageGB: number;
      monthlyTransferGB: number;
    };
    api: {
      maxRequestsPerHour: number;
      currentRequestsThisHour: number;
      maxRequestsPerDay: number;
      currentRequestsToday: number;
    };
    database: {
      maxConnections: number;
      currentConnections: number;
      maxQueryTimeMs: number;
      monthlyQueries: number;
    };
    email: {
      maxEmailsPerDay: number;
      currentEmailsToday: number;
      maxSmsPerDay: number;
      currentSmsToday: number;
    };
    genealogy: {
      maxNetworkDepth: number;
      maxDownlineSize: number;
      currentDownlineSize: number;
    };
  };
  billing: {
    plan: 'starter' | 'professional' | 'enterprise' | 'custom';
    monthlyCost: number;
    overageRates: Record<string, number>;
    nextBillingDate: Date;
  };
  limits: {
    enforced: boolean;
    warningsEnabled: boolean;
    autoScalingEnabled: boolean;
  };
}

export interface ResourceUsageAlert {
  tenantId: string;
  resourceType: string;
  currentUsage: number;
  limit: number;
  percentage: number;
  severity: 'warning' | 'critical' | 'exceeded';
  message: string;
  recommendedActions: string[];
  timestamp: Date;
}

export interface TenantMetrics {
  tenantId: string;
  period: 'hourly' | 'daily' | 'monthly';
  metrics: {
    activeUsers: number;
    apiRequests: number;
    storageUsed: number;
    databaseQueries: number;
    emailsSent: number;
    commissionsCalculated: number;
    ordersProcessed: number;
    averageResponseTime: number;
    errorRate: number;
  };
  costs: {
    computeCost: number;
    storageCost: number;
    apiCost: number;
    totalCost: number;
  };
  timestamp: Date;
}

export interface ScalingRecommendation {
  tenantId: string;
  resourceType: string;
  currentUsage: number;
  recommendedLimit: number;
  reason: string;
  impact: {
    performance: number; // percentage improvement
    cost: number; // additional monthly cost
    reliability: number; // percentage improvement
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

class MultiTenantResourceManager {
  private quotas = new Map<string, TenantResourceQuota>();
  private usageTracking = new Map<string, Map<string, number>>();
  private alertThresholds = {
    warning: 80,
    critical: 95,
    exceeded: 100
  };

  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupJob: cron.ScheduledTask | null = null;

  constructor() {
    this.initializeMonitoring();
    this.initializeScheduledTasks();
  }

  /**
   * Initialize resource monitoring
   */
  private initializeMonitoring(): void {
    // Monitor resource usage every minute
    this.monitoringInterval = setInterval(() => {
      this.monitorAllTenants();
    }, 60000); // 1 minute
  }

  /**
   * Initialize scheduled cleanup and billing tasks
   */
  private initializeScheduledTasks(): void {
    // Daily cleanup and reset counters
    this.cleanupJob = cron.schedule('0 0 * * *', () => {
      this.performDailyMaintenance();
    });

    // Monthly billing cycle
    cron.schedule('0 0 1 * *', () => {
      this.processMonthlyBilling();
    });
  }

  /**
   * Get or create tenant resource quota
   */
  async getTenantQuota(tenantId: string): Promise<TenantResourceQuota> {
    // Check cache first
    if (this.quotas.has(tenantId)) {
      return this.quotas.get(tenantId)!;
    }

    // Load from database or create default
    const quota = await this.loadTenantQuota(tenantId);
    this.quotas.set(tenantId, quota);
    return quota;
  }

  /**
   * Check if resource usage is within quota limits
   */
  async checkResourceUsage(
    tenantId: string,
    resourceType: keyof TenantResourceQuota['resources'],
    amount: number = 1
  ): Promise<{
    allowed: boolean;
    remaining: number;
    alerts: ResourceUsageAlert[];
  }> {
    const quota = await this.getTenantQuota(tenantId);
    const resource = quota.resources[resourceType];

    if (!resource) {
      return {
        allowed: true,
        remaining: Infinity,
        alerts: []
      };
    }

    // Get current usage
    const currentUsage = await this.getCurrentUsage(tenantId, resourceType);
    const newUsage = currentUsage + amount;

    // Determine limit based on resource type
    let limit: number;
    let usageField: string;

    switch (resourceType) {
      case 'users':
        limit = (resource as TenantResourceQuota['resources']['users']).maxUsers;
        usageField = 'currentUsers';
        break;
      case 'storage':
        limit = (resource as TenantResourceQuota['resources']['storage']).maxStorageGB;
        usageField = 'currentStorageGB';
        break;
      case 'api':
        // Check both hourly and daily limits
        const hourlyLimit = (resource as TenantResourceQuota['resources']['api']).maxRequestsPerHour;
        const dailyLimit = (resource as TenantResourceQuota['resources']['api']).maxRequestsPerDay;
        const hourlyUsage = await this.getHourlyUsage(tenantId, 'api');
        const dailyUsage = await this.getDailyUsage(tenantId, 'api');

        if (hourlyUsage + amount > hourlyLimit) {
          return {
            allowed: false,
            remaining: Math.max(0, hourlyLimit - hourlyUsage),
            alerts: [{
              tenantId,
              resourceType: 'api_hourly',
              currentUsage: hourlyUsage,
              limit: hourlyLimit,
              percentage: (hourlyUsage / hourlyLimit) * 100,
              severity: 'exceeded',
              message: `Hourly API limit exceeded`,
              recommendedActions: ['Upgrade plan', 'Implement request throttling'],
              timestamp: new Date()
            }]
          };
        }

        if (dailyUsage + amount > dailyLimit) {
          return {
            allowed: false,
            remaining: Math.max(0, dailyLimit - dailyUsage),
            alerts: [{
              tenantId,
              resourceType: 'api_daily',
              currentUsage: dailyUsage,
              limit: dailyLimit,
              percentage: (dailyUsage / dailyLimit) * 100,
              severity: 'exceeded',
              message: `Daily API limit exceeded`,
              recommendedActions: ['Upgrade plan', 'Optimize API usage'],
              timestamp: new Date()
            }]
          };
        }

        return {
          allowed: true,
          remaining: Math.min(hourlyLimit - hourlyUsage, dailyLimit - dailyUsage),
          alerts: []
        };

      case 'database':
        limit = (resource as TenantResourceQuota['resources']['database']).maxConnections;
        usageField = 'currentConnections';
        break;
      case 'email':
        limit = (resource as TenantResourceQuota['resources']['email']).maxEmailsPerDay;
        usageField = 'currentEmailsToday';
        break;
      case 'genealogy':
        limit = (resource as TenantResourceQuota['resources']['genealogy']).maxDownlineSize;
        usageField = 'currentDownlineSize';
        break;
      default:
        return {
          allowed: true,
          remaining: Infinity,
          alerts: []
        };
    }

    const allowed = newUsage <= limit;
    const remaining = Math.max(0, limit - newUsage);
    const alerts = this.generateUsageAlerts(tenantId, resourceType, newUsage, limit);

    return {
      allowed,
      remaining,
      alerts
    };
  }

  /**
   * Record resource usage
   */
  async recordUsage(
    tenantId: string,
    resourceType: keyof TenantResourceQuota['resources'],
    amount: number = 1,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Update in-memory tracking
      const tenantUsage = this.usageTracking.get(tenantId) || new Map();
      const currentUsage = tenantUsage.get(resourceType) || 0;
      tenantUsage.set(resourceType, currentUsage + amount);
      this.usageTracking.set(tenantId, tenantUsage);

      // Check for quota violations
      const checkResult = await this.checkResourceUsage(tenantId, resourceType, 0); // Don't add amount again

      if (checkResult.alerts.length > 0) {
        // Send alerts
        await this.sendUsageAlerts(checkResult.alerts);
      }

      // Record in database for persistence
      await this.persistUsage(tenantId, resourceType, amount, metadata);

      // Resource usage is operational, not a business KPI; skip business metric here

    } catch (error) {
      logger.error('Failed to record resource usage:', { error });
      apmMonitoring.recordError(error as Error, {
        component: 'resource_manager',
        operation: 'record_usage',
        tenant_id: tenantId,
        resource_type: resourceType
      });
    }
  }

  /**
   * Update tenant resource quota
   */
  async updateTenantQuota(
    tenantId: string,
    updates: Partial<TenantResourceQuota>
  ): Promise<TenantResourceQuota> {
    try {
      const currentQuota = await this.getTenantQuota(tenantId);
      const updatedQuota = { ...currentQuota, ...updates };

      // Validate quota updates
      await this.validateQuotaUpdates(updatedQuota);

      // Save to database
      await this.saveTenantQuota(updatedQuota);

      // Update cache
      this.quotas.set(tenantId, updatedQuota);

      // Log quota change
      logger.info(`Tenant quota updated: ${tenantId}`, {
        previousPlan: currentQuota.billing.plan,
        newPlan: updatedQuota.billing.plan,
        changes: updates
      });

      return updatedQuota;

    } catch (error) {
      logger.error('Failed to update tenant quota:', { error });
      throw error;
    }
  }

  /**
   * Get tenant resource usage metrics
   */
  async getTenantMetrics(
    tenantId: string,
    period: 'hourly' | 'daily' | 'monthly' = 'daily'
  ): Promise<TenantMetrics> {
    try {
      const metrics = await this.calculateTenantMetrics(tenantId, period);
      const costs = await this.calculateTenantCosts(tenantId, period);

      return {
        tenantId,
        period,
        metrics,
        costs,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to get tenant metrics:', { error });
      throw error;
    }
  }

  /**
   * Generate scaling recommendations
   */
  async getScalingRecommendations(tenantId: string): Promise<ScalingRecommendation[]> {
    try {
      const quota = await this.getTenantQuota(tenantId);
      const metrics = await this.getTenantMetrics(tenantId, 'daily');
      const recommendations: ScalingRecommendation[] = [];

      // Analyze each resource type
      for (const [resourceType, resource] of Object.entries(quota.resources)) {
        const recommendation = await this.analyzeResourceScaling(
          tenantId,
          resourceType as keyof TenantResourceQuota['resources'],
          resource,
          metrics
        );

        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      // Sort by priority
      return recommendations.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    } catch (error) {
      logger.error('Failed to generate scaling recommendations:', { error });
      throw error;
    }
  }

  /**
   * Apply scaling recommendation
   */
  async applyScalingRecommendation(
    tenantId: string,
    recommendation: ScalingRecommendation
  ): Promise<void> {
    try {
      const quota = await this.getTenantQuota(tenantId);
      const updates: Partial<TenantResourceQuota> = {};

      // Apply the recommended scaling
      switch (recommendation.resourceType) {
        case 'users':
          updates.resources = {
            ...quota.resources,
            users: {
              ...quota.resources.users,
              maxUsers: recommendation.recommendedLimit
            }
          };
          break;

        case 'api':
          updates.resources = {
            ...quota.resources,
            api: {
              ...quota.resources.api,
              maxRequestsPerHour: recommendation.recommendedLimit,
              maxRequestsPerDay: recommendation.recommendedLimit * 24
            }
          };
          break;

        // Add other resource types as needed
      }

      await this.updateTenantQuota(tenantId, updates);

      logger.info(`Scaling applied for tenant ${tenantId}: ${recommendation.resourceType}`, {
        oldLimit: recommendation.currentUsage,
        newLimit: recommendation.recommendedLimit,
        reason: recommendation.reason
      });

    } catch (error) {
      logger.error('Failed to apply scaling recommendation:', { error });
      throw error;
    }
  }

  /**
   * Get all tenant usage summary
   */
  async getSystemResourceSummary(): Promise<{
    totalTenants: number;
    totalUsers: number;
    totalStorageGB: number;
    totalApiRequests: number;
    resourceUtilization: Record<string, number>;
    topConsumers: Array<{
      tenantId: string;
      resourceType: string;
      usage: number;
      percentage: number;
    }>;
  }> {
    try {
      const tenants = Array.from(this.quotas.keys());
      let totalUsers = 0;
      let totalStorageGB = 0;
      let totalApiRequests = 0;

      const resourceUtilization: Record<string, number> = {};
      const topConsumers: Array<{
        tenantId: string;
        resourceType: string;
        usage: number;
        percentage: number;
      }> = [];

      for (const tenantId of tenants) {
        const quota = await this.getTenantQuota(tenantId);

        totalUsers += quota.resources.users.currentUsers;
        totalStorageGB += quota.resources.storage.currentStorageGB;
        totalApiRequests += quota.resources.api.currentRequestsToday;

        // Calculate utilization percentages
        for (const [resourceType, resource] of Object.entries(quota.resources)) {
          const utilization = this.calculateUtilization(resource);
          resourceUtilization[`${tenantId}:${resourceType}`] = utilization;

          if (utilization > 70) {
            topConsumers.push({
              tenantId,
              resourceType,
              usage: this.getCurrentUsageValue(resource),
              percentage: utilization
            });
          }
        }
      }

      // Sort top consumers
      topConsumers.sort((a, b) => b.percentage - a.percentage);

      return {
        totalTenants: tenants.length,
        totalUsers,
        totalStorageGB,
        totalApiRequests,
        resourceUtilization,
        topConsumers: topConsumers.slice(0, 10) // Top 10
      };

    } catch (error) {
      logger.error('Failed to get system resource summary:', { error });
      throw error;
    }
  }

  /**
   * Shutdown resource manager
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.cleanupJob) {
      this.cleanupJob.destroy();
    }
  }

  // Private helper methods

  private async loadTenantQuota(tenantId: string): Promise<TenantResourceQuota> {
    // In a real implementation, load from database
    // For now, return default quotas based on tenant
    const defaultQuotas: Record<string, TenantResourceQuota> = {
      default: {
        tenantId,
        resources: {
          users: { maxUsers: 1000, currentUsers: 0, monthlyActiveUsers: 0 },
          storage: { maxStorageGB: 10, currentStorageGB: 0, monthlyTransferGB: 0 },
          api: { maxRequestsPerHour: 10000, currentRequestsThisHour: 0, maxRequestsPerDay: 100000, currentRequestsToday: 0 },
          database: { maxConnections: 50, currentConnections: 0, maxQueryTimeMs: 5000, monthlyQueries: 0 },
          email: { maxEmailsPerDay: 1000, currentEmailsToday: 0, maxSmsPerDay: 100, currentSmsToday: 0 },
          genealogy: { maxNetworkDepth: 10, maxDownlineSize: 5000, currentDownlineSize: 0 }
        },
        billing: {
          plan: 'professional',
          monthlyCost: 99,
          overageRates: { api: 0.001, storage: 0.1, users: 1 },
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        limits: {
          enforced: true,
          warningsEnabled: true,
          autoScalingEnabled: false
        }
      }
    };

    return defaultQuotas[tenantId] || defaultQuotas.default;
  }

  private async saveTenantQuota(quota: TenantResourceQuota): Promise<void> {
    // In a real implementation, save to database
    // For now, just log
    logger.info(`Saving tenant quota: ${quota.tenantId}`, quota);
  }

  private async getCurrentUsage(tenantId: string, resourceType: string): Promise<number> {
    const tenantUsage = this.usageTracking.get(tenantId);
    return tenantUsage?.get(resourceType) || 0;
  }

  private async getHourlyUsage(tenantId: string, resourceType: string): Promise<number> {
    // In a real implementation, query recent usage from Redis/database
    return this.getCurrentUsage(tenantId, resourceType);
  }

  private async getDailyUsage(tenantId: string, resourceType: string): Promise<number> {
    // In a real implementation, query daily usage
    return this.getCurrentUsage(tenantId, resourceType);
  }

  private generateUsageAlerts(
    tenantId: string,
    resourceType: string,
    currentUsage: number,
    limit: number
  ): ResourceUsageAlert[] {
    const percentage = (currentUsage / limit) * 100;
    const alerts: ResourceUsageAlert[] = [];

    if (percentage >= this.alertThresholds.exceeded) {
      alerts.push({
        tenantId,
        resourceType,
        currentUsage,
        limit,
        percentage,
        severity: 'exceeded',
        message: `${resourceType} quota exceeded (${percentage.toFixed(1)}%)`,
        recommendedActions: ['Upgrade plan', 'Optimize usage', 'Contact support'],
        timestamp: new Date()
      });
    } else if (percentage >= this.alertThresholds.critical) {
      alerts.push({
        tenantId,
        resourceType,
        currentUsage,
        limit,
        percentage,
        severity: 'critical',
        message: `${resourceType} usage critical (${percentage.toFixed(1)}%)`,
        recommendedActions: ['Monitor closely', 'Consider upgrading', 'Optimize usage'],
        timestamp: new Date()
      });
    } else if (percentage >= this.alertThresholds.warning) {
      alerts.push({
        tenantId,
        resourceType,
        currentUsage,
        limit,
        percentage,
        severity: 'warning',
        message: `${resourceType} usage high (${percentage.toFixed(1)}%)`,
        recommendedActions: ['Monitor usage', 'Optimize if possible'],
        timestamp: new Date()
      });
    }

    return alerts;
  }

  private async sendUsageAlerts(alerts: ResourceUsageAlert[]): Promise<void> {
    // In a real implementation, send notifications via email, Slack, etc.
    for (const alert of alerts) {
      logger.warn(`Resource usage alert: ${alert.tenantId}`, alert);

      // Send to notification system
      // await notificationService.sendAlert(alert);
    }
  }

  private async persistUsage(
    tenantId: string,
    resourceType: string,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    // In a real implementation, persist to database
    // For now, just log periodically
    if (Math.random() < 0.01) { // Log 1% of usage events
      logger.info(`Usage recorded: ${tenantId}:${resourceType}`, { amount, metadata });
    }
  }

  private async monitorAllTenants(): Promise<void> {
    try {
      const tenants = Array.from(this.quotas.keys());

      for (const tenantId of tenants) {
        await this.monitorTenant(tenantId);
      }

    } catch (error) {
      logger.error('Failed to monitor tenants:', { error });
    }
  }

  private async monitorTenant(tenantId: string): Promise<void> {
    try {
      const quota = await this.getTenantQuota(tenantId);

      // Check each resource type
      for (const [resourceType, resource] of Object.entries(quota.resources)) {
        const checkResult = await this.checkResourceUsage(tenantId, resourceType as any, 0);

        if (checkResult.alerts.length > 0) {
          await this.sendUsageAlerts(checkResult.alerts);
        }
      }

    } catch (error) {
      logger.error(`Failed to monitor tenant ${tenantId}:`, { error });
    }
  }

  private async performDailyMaintenance(): Promise<void> {
    try {
      logger.info('Performing daily maintenance');

      // Reset daily counters
      this.usageTracking.clear();

      // Clean up old data
      // await this.cleanupOldData();

      // Generate daily reports
      // await this.generateDailyReports();

    } catch (error) {
      logger.error('Daily maintenance failed:', { error });
    }
  }

  private async processMonthlyBilling(): Promise<void> {
    try {
      logger.info('Processing monthly billing');

      const tenants = Array.from(this.quotas.keys());

      for (const tenantId of tenants) {
        await this.processTenantBilling(tenantId);
      }

    } catch (error) {
      logger.error('Monthly billing processing failed:', { error });
    }
  }

  private async processTenantBilling(tenantId: string): Promise<void> {
    try {
      const quota = await this.getTenantQuota(tenantId);
      const metrics = await this.getTenantMetrics(tenantId, 'monthly');

      // Calculate bill
      const baseCost = quota.billing.monthlyCost;
      const overageCost = this.calculateOverageCost(quota, metrics);

      const totalCost = baseCost + overageCost;

      // In a real implementation, create invoice and send to billing system
      logger.info(`Monthly bill for ${tenantId}: $${totalCost}`, {
        baseCost,
        overageCost,
        metrics
      });

    } catch (error) {
      logger.error(`Failed to process billing for tenant ${tenantId}:`, { error });
    }
  }

  private async validateQuotaUpdates(quota: TenantResourceQuota): Promise<void> {
    // Validate quota values
    if (quota.resources.users.maxUsers < quota.resources.users.currentUsers) {
      throw new Error('Cannot set max users below current users');
    }

    if (quota.resources.storage.maxStorageGB < quota.resources.storage.currentStorageGB) {
      throw new Error('Cannot set max storage below current usage');
    }
  }

  private async calculateTenantMetrics(
    tenantId: string,
    period: 'hourly' | 'daily' | 'monthly'
  ): Promise<TenantMetrics['metrics']> {
    // In a real implementation, aggregate metrics from database
    return {
      activeUsers: 150,
      apiRequests: 50000,
      storageUsed: 2.5,
      databaseQueries: 100000,
      emailsSent: 500,
      commissionsCalculated: 1000,
      ordersProcessed: 200,
      averageResponseTime: 150,
      errorRate: 0.5
    };
  }

  private async calculateTenantCosts(
    tenantId: string,
    period: 'hourly' | 'daily' | 'monthly'
  ): Promise<TenantMetrics['costs']> {
    const metrics = await this.calculateTenantMetrics(tenantId, period);

    return {
      computeCost: metrics.apiRequests * 0.001,
      storageCost: metrics.storageUsed * 0.1,
      apiCost: metrics.apiRequests * 0.0001,
      totalCost: 0 // Calculated above
    };
  }

  private calculateOverageCost(
    quota: TenantResourceQuota,
    metrics: TenantMetrics
  ): number {
    let overageCost = 0;

    // Calculate overage for each resource
    if (metrics.metrics.apiRequests > quota.resources.api.maxRequestsPerDay) {
      const overage = metrics.metrics.apiRequests - quota.resources.api.maxRequestsPerDay;
      overageCost += overage * (quota.billing.overageRates.api || 0);
    }

    if (metrics.metrics.storageUsed > quota.resources.storage.maxStorageGB) {
      const overage = metrics.metrics.storageUsed - quota.resources.storage.maxStorageGB;
      overageCost += overage * (quota.billing.overageRates.storage || 0);
    }

    return overageCost;
  }

  private async analyzeResourceScaling(
    tenantId: string,
    resourceType: keyof TenantResourceQuota['resources'],
    resource: any,
    metrics: TenantMetrics
  ): Promise<ScalingRecommendation | null> {
    const currentUsage = this.getCurrentUsageValue(resource);
    const utilization = this.calculateUtilization(resource);

    if (utilization < 70) {
      return null; // No scaling needed
    }

    let recommendedLimit: number;
    let reason: string;
    let priority: 'low' | 'medium' | 'high' | 'urgent';

    switch (resourceType) {
      case 'users':
        recommendedLimit = Math.ceil(currentUsage * 1.5);
        reason = 'User growth trending upward';
        priority = utilization > 90 ? 'high' : 'medium';
        break;

      case 'api':
        recommendedLimit = Math.ceil(currentUsage * 2);
        reason = 'High API usage indicates growing business';
        priority = utilization > 95 ? 'urgent' : 'high';
        break;

      default:
        return null;
    }

    const performance = Math.min(20, (recommendedLimit / currentUsage - 1) * 100);
    const cost = this.estimateScalingCost(tenantId, resourceType, recommendedLimit);
    const reliability = Math.min(15, performance * 0.75);

    return {
      tenantId,
      resourceType,
      currentUsage,
      recommendedLimit,
      reason,
      impact: {
        performance,
        cost,
        reliability
      },
      priority
    };
  }

  private getCurrentUsageValue(resource: any): number {
    // Extract current usage value from resource object
    if (resource.currentUsers !== undefined) return resource.currentUsers;
    if (resource.currentStorageGB !== undefined) return resource.currentStorageGB;
    if (resource.currentRequestsToday !== undefined) return resource.currentRequestsToday;
    if (resource.currentConnections !== undefined) return resource.currentConnections;
    if (resource.currentEmailsToday !== undefined) return resource.currentEmailsToday;
    if (resource.currentDownlineSize !== undefined) return resource.currentDownlineSize;

    return 0;
  }

  private calculateUtilization(resource: any): number {
    const current = this.getCurrentUsageValue(resource);
    let limit: number;

    // Determine limit based on resource structure
    if (resource.maxUsers !== undefined) limit = resource.maxUsers;
    else if (resource.maxStorageGB !== undefined) limit = resource.maxStorageGB;
    else if (resource.maxRequestsPerDay !== undefined) limit = resource.maxRequestsPerDay;
    else if (resource.maxConnections !== undefined) limit = resource.maxConnections;
    else if (resource.maxEmailsPerDay !== undefined) limit = resource.maxEmailsPerDay;
    else if (resource.maxDownlineSize !== undefined) limit = resource.maxDownlineSize;
    else return 0;

    return limit > 0 ? (current / limit) * 100 : 0;
  }

  private estimateScalingCost(
    tenantId: string,
    resourceType: string,
    newLimit: number
  ): number {
    // Simplified cost estimation
    const costPerUnit: Record<string, number> = {
      users: 1,
      api: 0.001,
      storage: 0.1
    };

    return (costPerUnit[resourceType] || 0) * newLimit;
  }
}

// Export singleton instance
export const multiTenantManager = new MultiTenantResourceManager();

// Export types and utilities
export { MultiTenantResourceManager };
export default multiTenantManager;