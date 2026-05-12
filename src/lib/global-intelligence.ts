import { prisma } from '@/lib/database';
import { checkSuperAdminAccess } from './superadmin-iam';

/**
 * Global Intelligence Dashboard - God's Eyes View
 * Provides omnipotent oversight across all tenants and systems
 */

export interface GlobalDashboardData {
  systemOverview: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    systemHealth: number;
    criticalAlerts: number;
  };
  tenantMetrics: Array<{
    companyId: string;
    name: string;
    status: string;
    userCount: number;
    revenue: number;
    growth: number;
    riskScore: number;
    lastActivity: Date;
  }>;
  realTimeActivity: Array<{
    timestamp: Date;
    eventType: string;
    tenantId: string;
    userId?: string;
    details: any;
  }>;
  predictiveInsights: Array<{
    type: string;
    title: string;
    description: string;
    confidence: number;
    affectedEntities: string[];
    recommendedActions: string[];
  }>;
  riskHeatmap: {
    regions: Array<{
      region: string;
      riskScore: number;
      tenantCount: number;
      criticalIssues: number;
    }>;
  };
}

/**
 * Get comprehensive global dashboard data
 */
export async function getGlobalDashboard(
  superAdminId: string,
  filters?: {
    timeRange?: string;
    region?: string;
    riskLevel?: string;
    tenantType?: string;
  }
): Promise<GlobalDashboardData> {
  // Validate super admin access (Level 1 required for global dashboard)
  const accessCheck = await checkSuperAdminAccess({
    userId: superAdminId,
    action: 'view',
    resource: 'global_dashboard',
    attributes: { level: 1 }
  });

  if (!accessCheck.allowed) {
    throw new Error('Insufficient permissions for global dashboard access');
  }

  // Parallel data fetching for optimal performance
  const [
    systemOverview,
    tenantMetrics,
    realTimeActivity,
    predictiveInsights,
    riskHeatmap
  ] = await Promise.all([
    getSystemOverview(filters),
    getTenantMetrics(filters),
    getRealTimeActivity(filters),
    getPredictiveInsights(filters),
    getRiskHeatmap(filters)
  ]);

  return {
    systemOverview,
    tenantMetrics,
    realTimeActivity,
    predictiveInsights,
    riskHeatmap
  };
}

/**
 * Get system-wide overview metrics
 */
async function getSystemOverview(filters?: any) {
  const [tenantStats, userStats, revenueStats, healthStats, alertStats] = await Promise.all([
    // Tenant statistics
    prisma.company.aggregate({
      _count: { id: true },
      where: {
        isActive: true,
        ...(filters?.region && { country: filters.region })
      }
    }),

    // User statistics
    prisma.user.aggregate({
      _count: { id: true },
      where: {
        active: true,
        lastActivityDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    }),

    // Revenue statistics (last 30 days)
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        status: 'Completed'
      }
    }),

    // System health from metrics
    prisma.systemHealthMetric.findFirst({
      where: { metricType: 'system_health' },
      orderBy: { timestamp: 'desc' }
    }),

    // Critical alerts
    prisma.alert.count({
      where: {
        severity: 'critical',
        status: 'active'
      }
    })
  ]);

  return {
    totalTenants: tenantStats._count.id,
    activeTenants: tenantStats._count.id, // Assuming all counted are active
    totalUsers: userStats._count.id,
    activeUsers: userStats._count.id,
    totalRevenue: revenueStats._sum.totalAmount || 0,
    systemHealth: healthStats?.value || 95,
    criticalAlerts: alertStats
  };
}

/**
 * Get tenant-level metrics with performance indicators
 */
async function getTenantMetrics(filters?: any) {
  const tenants = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(filters?.region && { country: filters.region })
    },
    include: {
      users: {
        where: { active: true },
        select: { id: true, lastActivityDate: true }
      },
      orders: {
        where: {
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          },
          status: 'Completed'
        },
        select: { totalAmount: true }
      },
      analytics: {
        where: {
          periodEnd: {
            gte: new Date()
          }
        },
        orderBy: { generatedAt: 'desc' },
        take: 1
      }
    },
    take: 100, // Limit for dashboard performance
    orderBy: { createdAt: 'desc' }
  });

  return tenants.map(tenant => {
    const recentOrders = tenant.orders.slice(-30); // Last 30 days
    const totalRevenue = recentOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate growth (simplified)
    const prevMonthOrders = tenant.orders.slice(-60, -30);
    const prevRevenue = prevMonthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const growth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Risk score from analytics (simplified)
    const riskScore = tenant.analytics[0]?.riskIndicators?.overall || 25;

    // Last activity
    const lastActivity = tenant.users
      .filter(u => u.lastActivityDate)
      .sort((a, b) => b.lastActivityDate!.getTime() - a.lastActivityDate!.getTime())[0]
      ?.lastActivityDate || tenant.createdAt;

    return {
      companyId: tenant.id,
      name: tenant.name,
      status: tenant.isActive ? 'active' : 'inactive',
      userCount: tenant.users.length,
      revenue: totalRevenue,
      growth: Math.round(growth * 100) / 100,
      riskScore: Math.round(riskScore * 100) / 100,
      lastActivity
    };
  });
}

/**
 * Get real-time activity feed
 */
async function getRealTimeActivity(filters?: any) {
  const activities = await prisma.superAdminAuditLog.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      },
      ...(filters?.tenantType && { companyId: filters.tenantType })
    },
    include: {
      superAdmin: {
        include: { user: { select: { firstName: true, surname: true } } }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return activities.map(activity => ({
    timestamp: activity.createdAt,
    eventType: activity.action,
    tenantId: activity.companyId || 'system',
    userId: activity.superAdmin.userId,
    details: {
      entityType: activity.entityType,
      entityId: activity.entityId,
      ipAddress: activity.ipAddress,
      riskScore: activity.riskScore
    }
  }));
}

/**
 * Get AI-generated predictive insights
 */
async function getPredictiveInsights(filters?: any) {
  const insights = await prisma.aIInsight.findMany({
    where: {
      status: 'active',
      generatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      },
      ...(filters?.riskLevel && { priority: filters.riskLevel })
    },
    orderBy: { generatedAt: 'desc' },
    take: 20
  });

  return insights.map(insight => ({
    type: insight.insightType,
    title: insight.title,
    description: insight.description,
    confidence: Math.round(insight.confidence * 100),
    affectedEntities: insight.entities as string[],
    recommendedActions: insight.actions as string[]
  }));
}

/**
 * Get risk heatmap by region
 */
async function getRiskHeatmap(filters?: any) {
  const regions = await prisma.company.groupBy({
    by: ['country'],
    _count: { id: true },
    where: { isActive: true }
  });

  // Calculate risk scores per region (simplified)
  const regionRisks = await Promise.all(
    regions.map(async (region) => {
      const companies = await prisma.company.findMany({
        where: { country: region.country },
        include: { analytics: { take: 1, orderBy: { generatedAt: 'desc' } } }
      });

      const avgRisk = companies.reduce((sum, company) => {
        return sum + (company.analytics[0]?.riskIndicators?.overall || 25);
      }, 0) / companies.length;

      const criticalIssues = companies.filter(company =>
        (company.analytics[0]?.riskIndicators?.overall || 0) > 75
      ).length;

      return {
        region: region.country,
        riskScore: Math.round(avgRisk * 100) / 100,
        tenantCount: region._count.id,
        criticalIssues
      };
    })
  );

  return { regions: regionRisks };
}

/**
 * Execute bulk operations across multiple tenants
 */
export async function executeBulkOperation(
  superAdminId: string,
  operation: {
    type: 'suspend_tenants' | 'update_configs' | 'send_notifications' | 'apply_policies';
    targetCriteria: any;
    action: any;
    justification: string;
  }
): Promise<{ commandId: string; estimatedAffected: number }> {
  // Validate super admin access
  const accessCheck = await checkSuperAdminAccess({
    userId: superAdminId,
    action: 'execute',
    resource: 'bulk_operation',
    attributes: { operationType: operation.type }
  });

  if (!accessCheck.allowed) {
    throw new Error('Insufficient permissions for bulk operations');
  }

  // Estimate affected entities
  const estimatedAffected = await estimateAffectedEntities(operation.targetCriteria);

  // Create system command record
  const command = await prisma.systemCommand.create({
    data: {
      commandType: operation.type,
      scope: 'bulk',
      targetCriteria: operation.targetCriteria,
      action: operation.action,
      justification: operation.justification,
      riskAssessment: await assessBulkOperationRisk(operation),
      executedBy: superAdminId,
      status: 'pending'
    }
  });

  // Log the command creation
  await prisma.superAdminAuditLog.create({
    data: {
      superAdminId,
      action: 'bulk_operation_created',
      entityType: 'system_command',
      entityId: command.id,
      metadata: {
        operationType: operation.type,
        estimatedAffected,
        justification: operation.justification
      }
    }
  });

  return {
    commandId: command.id,
    estimatedAffected
  };
}

/**
 * Estimate how many entities will be affected by bulk operation
 */
async function estimateAffectedEntities(criteria: any): Promise<number> {
  if (criteria.allTenants) {
    return await prisma.company.count({ where: { isActive: true } });
  }

  if (criteria.tenantIds) {
    return criteria.tenantIds.length;
  }

  if (criteria.filters) {
    return await prisma.company.count({
      where: {
        isActive: true,
        ...criteria.filters
      }
    });
  }

  return 0;
}

/**
 * Assess risk of bulk operation
 */
async function assessBulkOperationRisk(operation: any): Promise<any> {
  const affected = await estimateAffectedEntities(operation.targetCriteria);

  let riskLevel = 'low';
  if (affected > 100) riskLevel = 'medium';
  if (affected > 500) riskLevel = 'high';
  if (affected > 1000) riskLevel = 'critical';

  return {
    riskLevel,
    affectedEntities: affected,
    potentialImpact: calculatePotentialImpact(operation.type, affected),
    mitigationRequired: riskLevel === 'high' || riskLevel === 'critical'
  };
}

/**
 * Calculate potential impact of bulk operation
 */
function calculatePotentialImpact(operationType: string, affectedCount: number): string {
  switch (operationType) {
    case 'suspend_tenants':
      return affectedCount > 100 ? 'high' : 'medium';
    case 'update_configs':
      return affectedCount > 500 ? 'high' : 'medium';
    case 'send_notifications':
      return 'low';
    case 'apply_policies':
      return affectedCount > 200 ? 'medium' : 'low';
    default:
      return 'unknown';
  }
}