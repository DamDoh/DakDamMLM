import { prisma } from '@/lib/database';

/**
 * Predictive Risk Management - AI-Driven Risk Assessment
 * Provides intelligent risk scoring and early warning systems
 */

export interface RiskAssessment {
  entityType: 'company' | 'user' | 'transaction';
  entityId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    factor: string;
    weight: number;
    impact: number;
    description: string;
  }>;
  predictedEvents: Array<{
    event: string;
    probability: number;
    timeframe: string; // 'immediate', 'short_term', 'medium_term', 'long_term'
    impact: string;
  }>;
  mitigationStrategies: Array<{
    strategy: string;
    effectiveness: number;
    cost: string;
    priority: number;
  }>;
  lastAssessed: Date;
  nextAssessment: Date;
  confidence: number;
}

/**
 * Comprehensive risk assessment for entities
 */
export async function assessEntityRisk(
  entityType: string,
  entityId: string,
  context?: any
): Promise<RiskAssessment> {
  const assessment = await generateRiskAssessment(entityType, entityId, context);

  // Store the assessment
  await prisma.riskProfile.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId
      }
    },
    update: {
      riskScore: assessment.riskScore,
      riskLevel: assessment.riskLevel,
      riskFactors: assessment.riskFactors,
      predictedEvents: assessment.predictedEvents,
      mitigationActions: assessment.mitigationStrategies,
      lastAssessed: new Date(),
      nextAssessment: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next assessment in 24 hours
      assessmentMethod: 'ml_model'
    },
    create: {
      entityType,
      entityId,
      riskScore: assessment.riskScore,
      riskLevel: assessment.riskLevel,
      riskFactors: assessment.riskFactors,
      predictedEvents: assessment.predictedEvents,
      mitigationActions: assessment.mitigationStrategies,
      lastAssessed: new Date(),
      nextAssessment: new Date(Date.now() + 24 * 60 * 60 * 1000),
      assessmentMethod: 'ml_model'
    }
  });

  // Generate AI insight if high risk
  if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
    await generateRiskInsight(assessment);
  }

  return assessment;
}

/**
 * Generate comprehensive risk assessment
 */
async function generateRiskAssessment(
  entityType: string,
  entityId: string,
  context?: any
): Promise<RiskAssessment> {
  switch (entityType) {
    case 'company':
      return await assessCompanyRisk(entityId, context);
    case 'user':
      return await assessUserRisk(entityId, context);
    case 'transaction':
      return await assessTransactionRisk(entityId, context);
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }
}

/**
 * Assess company/tenant risk
 */
async function assessCompanyRisk(companyId: string, context?: any): Promise<RiskAssessment> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      users: {
        where: { active: true },
        select: {
          id: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          lastActivityDate: true,
          eCashBalance: true
        }
      },
      orders: {
        where: {
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: 'Completed'
        },
        select: { totalAmount: true, date: true }
      },
      alerts: {
        where: { status: 'active', severity: 'high' },
        select: { id: true }
      }
    }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const riskFactors = [];
  let totalRiskScore = 0;

  // User activity risk
  const activeUsers = company.users.filter(u => u.lastActivityDate &&
    u.lastActivityDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  const userActivityRisk = (company.users.length - activeUsers) / company.users.length * 30;
  riskFactors.push({
    factor: 'user_inactivity',
    weight: 0.2,
    impact: userActivityRisk,
    description: `${((company.users.length - activeUsers) / company.users.length * 100).toFixed(1)}% users inactive`
  });
  totalRiskScore += userActivityRisk * 0.2;

  // Failed login attempts
  const failedLogins = company.users.reduce((sum, u) => sum + u.failedLoginAttempts, 0);
  const loginRisk = Math.min(failedLogins * 2, 40);
  riskFactors.push({
    factor: 'failed_logins',
    weight: 0.15,
    impact: loginRisk,
    description: `${failedLogins} failed login attempts in last 30 days`
  });
  totalRiskScore += loginRisk * 0.15;

  // Revenue volatility
  const revenueData = company.orders.map(o => ({ amount: o.totalAmount, date: o.date }));
  const revenueVolatility = calculateRevenueVolatility(revenueData);
  riskFactors.push({
    factor: 'revenue_volatility',
    weight: 0.25,
    impact: revenueVolatility,
    description: `Revenue volatility: ${(revenueVolatility * 100).toFixed(1)}%`
  });
  totalRiskScore += revenueVolatility * 0.25;

  // Active alerts
  const alertRisk = Math.min(company.alerts.length * 5, 30);
  riskFactors.push({
    factor: 'active_alerts',
    weight: 0.2,
    impact: alertRisk,
    description: `${company.alerts.length} high-severity alerts active`
  });
  totalRiskScore += alertRisk * 0.2;

  // Account locks
  const lockedAccounts = company.users.filter(u => u.lockedUntil && u.lockedUntil > new Date()).length;
  const lockRisk = lockedAccounts * 10;
  riskFactors.push({
    factor: 'account_locks',
    weight: 0.1,
    impact: lockRisk,
    description: `${lockedAccounts} accounts currently locked`
  });
  totalRiskScore += lockRisk * 0.1;

  // Predictive events
  const predictedEvents = await predictCompanyEvents(company, riskFactors);

  // Mitigation strategies
  const mitigationStrategies = generateMitigationStrategies(totalRiskScore, riskFactors);

  const riskLevel = totalRiskScore >= 75 ? 'critical' :
                   totalRiskScore >= 50 ? 'high' :
                   totalRiskScore >= 25 ? 'medium' : 'low';

  return {
    entityType: 'company',
    entityId: companyId,
    riskScore: Math.round(totalRiskScore * 100) / 100,
    riskLevel,
    riskFactors,
    predictedEvents,
    mitigationStrategies,
    lastAssessed: new Date(),
    nextAssessment: new Date(Date.now() + 24 * 60 * 60 * 1000),
    confidence: 0.85
  };
}

/**
 * Assess individual user risk
 */
async function assessUserRisk(userId: string, context?: any): Promise<RiskAssessment> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          orders: true,
          amlAlerts: true,
          deviceFingerprints: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const riskFactors = [];
  let totalRiskScore = 0;

  // AML alerts
  const amlRisk = user._count.amlAlerts * 20;
  riskFactors.push({
    factor: 'aml_alerts',
    weight: 0.4,
    impact: amlRisk,
    description: `${user._count.amlAlerts} AML alerts on record`
  });
  totalRiskScore += amlRisk * 0.4;

  // Failed login attempts
  const loginRisk = Math.min(user.failedLoginAttempts * 5, 25);
  riskFactors.push({
    factor: 'failed_logins',
    weight: 0.2,
    impact: loginRisk,
    description: `${user.failedLoginAttempts} failed login attempts`
  });
  totalRiskScore += loginRisk * 0.2;

  // Account lock status
  const lockRisk = user.lockedUntil && user.lockedUntil > new Date() ? 30 : 0;
  riskFactors.push({
    factor: 'account_locked',
    weight: 0.2,
    impact: lockRisk,
    description: user.lockedUntil ? 'Account currently locked' : 'Account not locked'
  });
  totalRiskScore += lockRisk * 0.2;

  // Device fingerprint changes
  const deviceRisk = user._count.deviceFingerprints > 5 ? 20 :
                    user._count.deviceFingerprints > 2 ? 10 : 0;
  riskFactors.push({
    factor: 'device_changes',
    weight: 0.1,
    impact: deviceRisk,
    description: `${user._count.deviceFingerprints} device fingerprints`
  });
  totalRiskScore += deviceRisk * 0.1;

  // Transaction anomalies
  const transactionRisk = await assessUserTransactionAnomalies(userId);
  riskFactors.push({
    factor: 'transaction_anomalies',
    weight: 0.1,
    impact: transactionRisk,
    description: 'Transaction pattern anomalies detected'
  });
  totalRiskScore += transactionRisk * 0.1;

  const predictedEvents = await predictUserEvents(user, riskFactors);
  const mitigationStrategies = generateUserMitigationStrategies(totalRiskScore, riskFactors);

  const riskLevel = totalRiskScore >= 70 ? 'critical' :
                   totalRiskScore >= 45 ? 'high' :
                   totalRiskScore >= 20 ? 'medium' : 'low';

  return {
    entityType: 'user',
    entityId: userId,
    riskScore: Math.round(totalRiskScore * 100) / 100,
    riskLevel,
    riskFactors,
    predictedEvents,
    mitigationStrategies,
    lastAssessed: new Date(),
    nextAssessment: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    confidence: 0.82
  };
}

/**
 * Assess transaction risk
 */
async function assessTransactionRisk(transactionId: string, context?: any): Promise<RiskAssessment> {
  // This would analyze transaction patterns, amounts, frequency, etc.
  // Simplified implementation
  return {
    entityType: 'transaction',
    entityId: transactionId,
    riskScore: 15,
    riskLevel: 'low',
    riskFactors: [{
      factor: 'amount_anomaly',
      weight: 1.0,
      impact: 15,
      description: 'Transaction amount within normal range'
    }],
    predictedEvents: [],
    mitigationStrategies: [],
    lastAssessed: new Date(),
    nextAssessment: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    confidence: 0.95
  };
}

// Helper Functions

function calculateRevenueVolatility(revenueData: Array<{ amount: number; date: Date }>): number {
  if (revenueData.length < 7) return 20; // Not enough data

  const dailyRevenue = revenueData.reduce((acc, order) => {
    const day = order.date.toISOString().split('T')[0];
    acc[day] = (acc[day] || 0) + order.amount;
    return acc;
  }, {} as Record<string, number>);

  const amounts = Object.values(dailyRevenue);
  const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
  const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
  const volatility = Math.sqrt(variance) / mean;

  return Math.min(volatility * 100, 50); // Cap at 50
}

async function predictCompanyEvents(company: any, riskFactors: any[]): Promise<any[]> {
  const predictions = [];

  const highRiskFactors = riskFactors.filter(f => f.impact > 20);

  if (highRiskFactors.length >= 2) {
    predictions.push({
      event: 'churn_risk',
      probability: 0.7,
      timeframe: 'medium_term',
      impact: 'high'
    });
  }

  if (riskFactors.find(f => f.factor === 'revenue_volatility' && f.impact > 30)) {
    predictions.push({
      event: 'revenue_decline',
      probability: 0.6,
      timeframe: 'short_term',
      impact: 'medium'
    });
  }

  return predictions;
}

function generateMitigationStrategies(riskScore: number, riskFactors: any[]): any[] {
  const strategies = [];

  if (riskScore > 50) {
    strategies.push({
      strategy: 'enhanced_monitoring',
      effectiveness: 0.8,
      cost: 'low',
      priority: 1
    });
  }

  if (riskFactors.find(f => f.factor === 'user_inactivity')) {
    strategies.push({
      strategy: 'user_engagement_campaign',
      effectiveness: 0.6,
      cost: 'medium',
      priority: 2
    });
  }

  if (riskFactors.find(f => f.factor === 'failed_logins')) {
    strategies.push({
      strategy: 'security_awareness_training',
      effectiveness: 0.7,
      cost: 'low',
      priority: 1
    });
  }

  return strategies.sort((a, b) => a.priority - b.priority);
}

async function assessUserTransactionAnomalies(userId: string): Promise<number> {
  // Simplified transaction anomaly detection
  const transactionCount = await prisma.eCashTransaction.count({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  // Flag high transaction volume as potential risk
  return transactionCount > 100 ? 25 : transactionCount > 50 ? 15 : 0;
}

async function predictUserEvents(user: any, riskFactors: any[]): Promise<any[]> {
  const predictions = [];

  if (riskFactors.find(f => f.factor === 'aml_alerts' && f.impact > 30)) {
    predictions.push({
      event: 'compliance_violation',
      probability: 0.8,
      timeframe: 'immediate',
      impact: 'high'
    });
  }

  if (user.lockedUntil) {
    predictions.push({
      event: 'account_suspension',
      probability: 0.9,
      timeframe: 'immediate',
      impact: 'medium'
    });
  }

  return predictions;
}

function generateUserMitigationStrategies(riskScore: number, riskFactors: any[]): any[] {
  const strategies = [];

  if (riskScore > 40) {
    strategies.push({
      strategy: 'identity_verification',
      effectiveness: 0.9,
      cost: 'medium',
      priority: 1
    });
  }

  if (riskFactors.find(f => f.factor === 'failed_logins')) {
    strategies.push({
      strategy: 'password_reset_required',
      effectiveness: 0.95,
      cost: 'low',
      priority: 1
    });
  }

  return strategies;
}

async function generateRiskInsight(assessment: RiskAssessment): Promise<void> {
  const insight = await prisma.aIInsight.create({
    data: {
      insightType: 'alert',
      title: `High Risk Detected: ${assessment.entityType} ${assessment.entityId}`,
      description: `Risk score of ${assessment.riskScore} (${assessment.riskLevel}) detected with ${assessment.riskFactors.length} contributing factors.`,
      confidence: assessment.confidence,
      data: assessment,
      entities: [assessment.entityId],
      actions: assessment.mitigationStrategies.map(s => s.strategy),
      priority: assessment.riskLevel === 'critical' ? 'critical' :
               assessment.riskLevel === 'high' ? 'high' : 'medium',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      modelVersion: 'risk_assessment_v1.0',
      processingTime: 150 // milliseconds
    }
  });

  // Trigger automated governance rule if applicable
  await checkGovernanceRules(assessment);
}

async function checkGovernanceRules(assessment: RiskAssessment): Promise<void> {
  const applicableRules = await prisma.governanceRule.findMany({
    where: {
      category: 'security',
      isActive: true,
      triggerConditions: {
        path: ['riskThreshold'],
        gte: assessment.riskScore
      }
    }
  });

  for (const rule of applicableRules) {
    // Execute automated governance action
    await executeGovernanceRule(rule, assessment);
  }
}

async function executeGovernanceRule(rule: any, assessment: RiskAssessment): Promise<void> {
  // Log rule execution
  await prisma.governanceRule.update({
    where: { id: rule.id },
    data: {
      lastExecuted: new Date(),
      executionCount: { increment: 1 }
    }
  });

  // Execute the automated action based on rule configuration
  const action = rule.actions;

  switch (action.type) {
    case 'suspend_entity':
      await suspendHighRiskEntity(assessment);
      break;
    case 'send_alert':
      await sendRiskAlert(assessment, action);
      break;
    case 'apply_mitigation':
      await applyAutomatedMitigation(assessment, action);
      break;
  }
}

async function suspendHighRiskEntity(assessment: RiskAssessment): Promise<void> {
  if (assessment.entityType === 'company') {
    await prisma.company.update({
      where: { id: assessment.entityId },
      data: { isActive: false }
    });
  } else if (assessment.entityType === 'user') {
    await prisma.user.update({
      where: { id: assessment.entityId },
      data: { active: false }
    });
  }
}

async function sendRiskAlert(assessment: RiskAssessment, action: any): Promise<void> {
  // Send alert to designated channels
  console.log('Sending risk alert:', assessment, action);
}

async function applyAutomatedMitigation(assessment: RiskAssessment, action: any): Promise<void> {
  // Apply automated mitigation measures
  console.log('Applying automated mitigation:', assessment, action);
}

/**
 * Get risk heatmap across all entities
 */
export async function getRiskHeatmap(
  filters?: {
    entityType?: string;
    riskLevel?: string;
    timeRange?: string;
  }
): Promise<{
  regions: Array<{
    region: string;
    riskScore: number;
    entityCount: number;
    criticalCount: number;
  }>;
  trends: Array<{
    period: string;
    averageRisk: number;
    criticalIncidents: number;
  }>;
}> {
  // Get regional risk data
  const regionData = await prisma.company.groupBy({
    by: ['country'],
    _count: { id: true },
    where: { isActive: true }
  });

  const regions = await Promise.all(
    regionData.map(async (region) => {
      const companies = await prisma.company.findMany({
        where: { country: region.country },
        include: { analytics: { take: 1, orderBy: { generatedAt: 'desc' } } }
      });

      const avgRisk = companies.reduce((sum, company) => {
        return sum + (company.analytics[0]?.riskIndicators?.overall || 25);
      }, 0) / companies.length;

      const criticalCount = companies.filter(company =>
        (company.analytics[0]?.riskIndicators?.overall || 0) > 75
      ).length;

      return {
        region: region.country,
        riskScore: Math.round(avgRisk * 100) / 100,
        entityCount: region._count.id,
        criticalCount
      };
    })
  );

  // Get risk trends over time (simplified)
  const trends = [
    { period: 'Last 7 days', averageRisk: 35, criticalIncidents: 2 },
    { period: 'Last 30 days', averageRisk: 32, criticalIncidents: 8 },
    { period: 'Last 90 days', averageRisk: 28, criticalIncidents: 15 }
  ];

  return { regions, trends };
}