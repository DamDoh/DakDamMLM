// Analytics Microservice - Prisma-based Business Intelligence
// Handles all analytics, reporting, and commission forecasting

'use server';

import { db } from '../shared/database';
import {
  ServiceErrorHandler,
  ResponseUtils,
  ValidationUtils,
  PerformanceUtils,
  CacheUtils,
  roundToDecimal,
  DateUtils
} from '../shared/utils';
import type {
  AnalyticsMetric,
  GrowthAnalytics,
  PredictiveAnalytics,
  BusinessHealthScore,
  Member,
  Commission,
  Order
} from '../shared/types';

// Business rules for analytics calculations
const ANALYTICS_CONFIG = {
  cache: {
    keyMetrics: 300000, // 5 minutes
    growthAnalytics: 600000, // 10 minutes
    predictions: 1800000, // 30 minutes
  },
  thresholds: {
    minPVForCommission: 50,
    inactivityDays: 90,
    riskScoreThresholds: {
      high: 70,
      medium: 40,
    },
  },
  forecasting: {
    growthRate: {
      min: -0.1, // -10%
      max: 0.5,  // +50%
      default: 0.05, // +5%
    },
    teamGrowth: 0.02, // 2% monthly
    pvGrowth: 0.15,   // 15% monthly
  },
};

class AnalyticsEngine {
  private cache = new Map<string, { data: any; expiry: number }>();

  // Cache management with TTL
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  // Main analytics methods
  async getKeyMetrics(period: 'day' | 'week' | 'month' | 'quarter' = 'month'): Promise<AnalyticsMetric[]> {
    const cacheKey = `metrics-${period}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    const timerId = PerformanceUtils.startTimer('getKeyMetrics');

    try {
      const metrics: AnalyticsMetric[] = [];

      // Total Members
      const totalMembers = await this.getTotalMembers();
      metrics.push({
        id: 'total-members',
        name: 'Total Members',
        value: totalMembers,
        category: 'members',
        trend: 'up',
        period
      });

      // Active Members
      const activeMembers = await this.getActiveMembers();
      metrics.push({
        id: 'active-members',
        name: 'Active Members',
        value: activeMembers,
        category: 'members',
        trend: 'up',
        period
      });

      // Total Commissions
      const totalCommissions = await this.getTotalCommissions();
      metrics.push({
        id: 'total-commissions',
        name: 'Total Commissions',
        value: totalCommissions,
        category: 'commissions',
        trend: 'up',
        period
      });

      // Average Order Value
      const avgOrderValue = await this.getAverageOrderValue();
      metrics.push({
        id: 'avg-order-value',
        name: 'Average Order Value',
        value: avgOrderValue,
        category: 'orders',
        trend: 'stable',
        period
      });

      // Member Retention Rate
      const retentionRate = await this.getRetentionRate();
      metrics.push({
        id: 'retention-rate',
        name: 'Retention Rate',
        value: retentionRate,
        category: 'retention',
        trend: retentionRate > 80 ? 'up' : 'down',
        period
      });

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Analytics: Key metrics calculated in ${duration}ms`);

      this.setCachedData(cacheKey, metrics, ANALYTICS_CONFIG.cache.keyMetrics);
      return metrics;
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to get key metrics:', error);
      throw ServiceErrorHandler.createError('ANALYTICS_ERROR', 'Failed to calculate key metrics');
    }
  }

  async getGrowthAnalytics(period: string = '30d'): Promise<GrowthAnalytics> {
    const cacheKey = `growth-${period}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    const timerId = PerformanceUtils.startTimer('getGrowthAnalytics');

    try {
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        newMembers,
        activeMembers,
        totalMembers,
        retentionRate,
        topPerformers,
        avgOrderValue,
        totalVolume
      ] = await Promise.all([
        this.getNewMembersSince(startDate),
        this.getActiveMembers(),
        this.getTotalMembers(),
        this.getRetentionRate(),
        this.getTopPerformers(10),
        this.getAverageOrderValue(),
        this.getTotalVolume(),
      ]);

      const analytics: GrowthAnalytics = {
        period,
        newMembers,
        activeMembers,
        totalMembers,
        retentionRate,
        churnRate: 100 - retentionRate,
        averageOrderValue: avgOrderValue,
        totalVolume: totalVolume,
        topPerformers
      };

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Analytics: Growth analytics calculated in ${duration}ms`);

      this.setCachedData(cacheKey, analytics, ANALYTICS_CONFIG.cache.growthAnalytics);
      return analytics;
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to get growth analytics:', error);
      throw ServiceErrorHandler.createError('ANALYTICS_ERROR', 'Failed to calculate growth analytics');
    }
  }

  async predictMemberCommission(memberId: string, monthsAhead: number = 3): Promise<{
    predictedMonthly: number[];
    confidence: number;
    factors: string[];
    breakdown: {
      binary: number[];
      matching: number[];
      stockist: number[];
      rank: number[];
    };
  }> {
    const cacheKey = `prediction-${memberId}-${monthsAhead}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    const timerId = PerformanceUtils.startTimer('predictMemberCommission');

    try {
      // Get member data
      const member = await db.user.findUnique({
        where: { id: memberId }
      });

      if (!member) {
        throw ServiceErrorHandler.createError('MEMBER_NOT_FOUND', 'Member not found');
      }

      // Get historical commission data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const historicalCommissionsRaw = await db.commission.findMany({
        where: {
          userId: memberId,
          date: {
            gte: sixMonthsAgo.toISOString()
          }
        },
        orderBy: { date: 'desc' }
      });

      // Transform Prisma data to match our interface
      const historicalCommissions: Commission[] = historicalCommissionsRaw.map(c => ({
        id: c.id,
        userId: c.userId,
        date: c.date.toISOString(), // Convert Date to string
        type: c.type,
        status: c.status as 'Paid' | 'Pending' | 'Failed',
        amount: c.amount
      }));

      // Group commissions by month
      const monthlyTotals = this.groupCommissionsByMonth(historicalCommissions);

      // Calculate growth trends
      const growthRate = this.calculateCommissionGrowthRate(monthlyTotals);
      const avgCommission = monthlyTotals.length > 0 ?
        monthlyTotals.reduce((sum, month) => sum + month.total, 0) / monthlyTotals.length : 0;

      // Factor in current member metrics
      const teamSize = member.teamSize as any; // JSON field from Prisma
      const teamGrowth = teamSize?.total * ANALYTICS_CONFIG.forecasting.teamGrowth || 0;
      const pvGrowth = member.pv * ANALYTICS_CONFIG.forecasting.pvGrowth;
      const rankMultiplier = this.getRankCommissionMultiplier(member.rank || 'Member');

      // Generate predictions
      const predictions = [];
      const binaryPredictions = [];
      const matchingPredictions = [];
      const stockistPredictions = [];
      const rankPredictions = [];

      let currentBase = Math.max(avgCommission, 0);

      // For new members with no commission history
      if (monthlyTotals.length === 0) {
        currentBase = Math.max(member.pv * 0.05, 0); // 5% of PV as base commission estimate
      }

      // If still no base, return zero predictions for new members
      if (currentBase === 0 && monthlyTotals.length === 0) {
        const zeroPredictions = Array(monthsAhead).fill(0);
        const result = {
          predictedMonthly: zeroPredictions,
          confidence: 0.1,
          factors: ['New member with no commission history', 'No personal volume recorded'],
          breakdown: {
            binary: zeroPredictions,
            matching: zeroPredictions,
            stockist: zeroPredictions,
            rank: zeroPredictions,
          }
        };

        const duration = PerformanceUtils.endTimer(timerId);
        console.log(`Analytics: Zero predictions for new member ${memberId} in ${duration}ms`);

        this.setCachedData(cacheKey, result, ANALYTICS_CONFIG.cache.predictions);
        return result;
      }

      for (let i = 1; i <= monthsAhead; i++) {
        // Apply growth factors
        const monthMultiplier = Math.pow(1 + growthRate + teamGrowth + pvGrowth, i * 0.1);
        const rankAdjusted = currentBase * monthMultiplier * rankMultiplier;

        // Distribute across commission types
        const binaryAmount = roundToDecimal(rankAdjusted * 0.6);
        const matchingAmount = roundToDecimal(rankAdjusted * 0.25);
        const stockistAmount = member.storeOwnerLevel ? roundToDecimal(rankAdjusted * 0.1) : 0;
        const rankAmount = roundToDecimal(rankAdjusted * 0.05);

        const totalMonthly = roundToDecimal(binaryAmount + matchingAmount + stockistAmount + rankAmount);

        predictions.push(totalMonthly);
        binaryPredictions.push(binaryAmount);
        matchingPredictions.push(matchingAmount);
        stockistPredictions.push(stockistAmount);
        rankPredictions.push(rankAmount);

        currentBase = totalMonthly;
      }

      // Calculate confidence based on data quality
      const confidence = this.calculatePredictionConfidence(monthlyTotals, member);
      const factors = this.generatePredictionFactors(member, growthRate, teamGrowth);

      const result = {
        predictedMonthly: predictions,
        confidence,
        factors,
        breakdown: {
          binary: binaryPredictions,
          matching: matchingPredictions,
          stockist: stockistPredictions,
          rank: rankPredictions,
        }
      };

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Analytics: Commission prediction for ${memberId} completed in ${duration}ms`);

      this.setCachedData(cacheKey, result, ANALYTICS_CONFIG.cache.predictions);
      return result;
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to predict member commission:', error);
      throw error;
    }
  }

  async getBusinessHealthScore(): Promise<BusinessHealthScore> {
    const timerId = PerformanceUtils.startTimer('getBusinessHealthScore');

    try {
      const metrics = await this.getKeyMetrics('month');

      // Calculate component scores
      const growth = this.calculateGrowthScore(metrics);
      const retention = this.calculateRetentionScore(metrics);
      const productivity = this.calculateProductivityScore(metrics);
      const compliance = await this.calculateComplianceScore();
      const financial = await this.calculateFinancialScore();

      const overall = Math.round((growth + retention + productivity + compliance + financial) / 5);

      // Determine trends
      const trends: BusinessHealthScore['trends'] = {
        growth: growth > 70 ? 'improving' : growth < 50 ? 'declining' : 'stable',
        retention: retention > 75 ? 'improving' : retention < 60 ? 'declining' : 'stable',
        productivity: productivity > 70 ? 'improving' : productivity < 50 ? 'declining' : 'stable'
      };

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations({
        growth,
        retention,
        productivity,
        compliance,
        financial
      });

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Analytics: Business health score calculated in ${duration}ms`);

      return {
        overall,
        components: {
          growth,
          retention,
          productivity,
          compliance,
          financial
        },
        trends,
        recommendations
      };
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to get business health score:', error);
      throw ServiceErrorHandler.createError('ANALYTICS_ERROR', 'Failed to calculate business health score');
    }
  }

  // Helper methods using Prisma instead of Firebase
  private async getTotalMembers(): Promise<number> {
    try {
      const count = await db.user.count({
        where: { isAdmin: false }
      });
      return count;
    } catch (error) {
      console.error('Failed to get total members:', error);
      return 0;
    }
  }

  private async getActiveMembers(): Promise<number> {
    try {
      const count = await db.user.count({
        where: {
          active: true,
          isAdmin: false
        }
      });
      return count;
    } catch (error) {
      console.error('Failed to get active members:', error);
      return 0;
    }
  }

  private async getNewMembersSince(date: Date): Promise<number> {
    try {
      const count = await db.user.count({
        where: {
          createdAt: {
            gte: date.toISOString()
          },
          isAdmin: false
        }
      });
      return count;
    } catch (error) {
      console.error('Failed to get new members since date:', error);
      return 0;
    }
  }

  private async getTotalCommissions(): Promise<number> {
    try {
      const result = await db.commission.aggregate({
        _sum: {
          amount: true
        }
      });

      return Number(result._sum.amount) || 0;
    } catch (error) {
      console.error('Failed to get total commissions:', error);
      return 0;
    }
  }

  private async getAverageOrderValue(): Promise<number> {
    try {
      const result = await db.order.aggregate({
        _avg: {
          totalAmount: true
        }
      });

      return Number(result._avg.totalAmount) || 0;
    } catch (error) {
      console.error('Failed to get average order value:', error);
      return 0;
    }
  }

  private async getRetentionRate(): Promise<number> {
    const totalMembers = await this.getTotalMembers();
    if (totalMembers === 0) return 0;
    const activeMembers = await this.getActiveMembers();
    return Math.round((activeMembers / totalMembers) * 100);
  }

  private async getTotalVolume(): Promise<number> {
    try {
      const result = await db.order.aggregate({
        _sum: {
          totalAmount: true
        }
      });

      return Number(result._sum.totalAmount) || 0;
    } catch (error) {
      console.error('Failed to get total volume:', error);
      return 0;
    }
  }

  private async getTopPerformers(count: number): Promise<GrowthAnalytics['topPerformers']> {
    try {
      const topMembers = await db.user.findMany({
        where: {
          active: true,
          isAdmin: false
        },
        orderBy: {
          pv: 'desc'
        },
        take: count
      });

      return topMembers.map(member => ({
        memberId: member.memberId || member.id,
        name: member.fullName,
        volume: member.pv,
        growth: 0, // Growth calculation would require historical data
      }));
    } catch (error) {
      console.error('Failed to get top performers:', error);
      return [];
    }
  }

  // Analytics calculation helpers
  private groupCommissionsByMonth(commissions: Commission[]): Array<{month: string, total: number, count: number}> {
    const monthlyMap = new Map<string, {total: number, count: number}>();

    commissions.forEach(commission => {
      const date = new Date(commission.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { total: 0, count: 0 });
      }

      const monthData = monthlyMap.get(monthKey)!;
      monthData.total += commission.amount;
      monthData.count += 1;
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateCommissionGrowthRate(monthlyTotals: Array<{month: string, total: number, count: number}>): number {
    if (monthlyTotals.length < 2) return ANALYTICS_CONFIG.forecasting.growthRate.default;

    const recent = monthlyTotals.slice(-3);
    const earlier = monthlyTotals.slice(-6, -3);

    const recentAvg = recent.reduce((sum, m) => sum + m.total, 0) / recent.length;
    const earlierAvg = earlier.length > 0 ?
      earlier.reduce((sum, m) => sum + m.total, 0) / earlier.length : recentAvg;

    if (earlierAvg === 0) return ANALYTICS_CONFIG.forecasting.growthRate.default;

    const growthRate = (recentAvg - earlierAvg) / earlierAvg;
    return Math.max(ANALYTICS_CONFIG.forecasting.growthRate.min,
           Math.min(growthRate, ANALYTICS_CONFIG.forecasting.growthRate.max));
  }

  private getRankCommissionMultiplier(rank: string): number {
    const multipliers: Record<string, number> = {
      'Member': 1.0,
      'Bronze': 1.2,
      'Silver': 1.5,
      'Gold': 2.0,
      'Diamond': 3.0,
      'Super Diamond': 4.0,
      'Half STAR': 5.0,
      'STAR': 6.0,
      'Supervisor': 7.0,
      'Manager': 8.0,
      'Director': 10.0,
      'President': 12.0,
      'Chairman': 15.0,
      'Blue Diamond': 4.0,
      'Black Diamond': 5.0,
      'Emerald': 6.0,
      'Blue Emerald': 7.0,
      'Elite': 8.0,
      'Crown': 12.0,
      'Double Diamond': 4.0,
      'Expired': 0.5,
    };

    return multipliers[rank] || 1.0;
  }

  private calculatePredictionConfidence(
    monthlyTotals: Array<{month: string, total: number, count: number}>,
    member: any
  ): number {
    let confidence = 0.5;

    if (monthlyTotals.length >= 6) confidence += 0.2;
    if (monthlyTotals.length >= 3) confidence += 0.1;
    if (member.pv > 500) confidence += 0.1;
    if (member.teamSize?.total > 10) confidence += 0.1;
    if (member.active) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private generatePredictionFactors(member: any, growthRate: number, teamGrowth: number): string[] {
    const factors = [];

    if (growthRate > 0.1) factors.push('Strong historical growth trend');
    else if (growthRate > 0) factors.push('Moderate growth trend');
    else factors.push('Stable commission history');

    if (member.pv > 1000) factors.push('High personal volume');
    else if (member.pv > 500) factors.push('Good personal volume');

    if (member.teamSize?.total > 50) factors.push('Large team size');
    else if (member.teamSize?.total > 10) factors.push('Growing team');

    if (teamGrowth > 0.05) factors.push('Team expansion opportunity');

    if (member.storeOwnerLevel) factors.push('Stockist bonus potential');

    return factors;
  }

  private calculateGrowthScore(metrics: AnalyticsMetric[]): number {
    const memberMetrics = metrics.find(m => m.id === 'total-members');
    const activeMetrics = metrics.find(m => m.id === 'active-members');

    if (!memberMetrics || !activeMetrics || memberMetrics.value === 0) return 0;

    const growthRate = (activeMetrics.value / memberMetrics.value) * 100;
    return Math.min(growthRate, 100);
  }

  private calculateRetentionScore(metrics: AnalyticsMetric[]): number {
    const retentionMetric = metrics.find(m => m.id === 'retention-rate');
    return retentionMetric?.value || 0;
  }

  private calculateProductivityScore(metrics: AnalyticsMetric[]): number {
    const commissionMetric = metrics.find(m => m.id === 'total-commissions');
    const avgOrderMetric = metrics.find(m => m.id === 'avg-order-value');

    if (!commissionMetric || !avgOrderMetric) return 0;

    const productivity = (commissionMetric.value / Math.max(avgOrderMetric.value, 1)) / 100;
    return Math.min(productivity, 100);
  }

  private async calculateComplianceScore(): Promise<number> {
    try {
      const totalMembers = await db.user.count({
        where: { isAdmin: false }
      });

      if (totalMembers === 0) return 0;

      // For now, assume 80% compliance - in real implementation, check actual agreements
      return 80;
    } catch (error) {
      console.error('Failed to calculate compliance score:', error);
      return 0;
    }
  }

  private async calculateFinancialScore(): Promise<number> {
    try {
      const [totalRevenue, totalCommissions] = await Promise.all([
        this.getTotalVolume(),
        this.getTotalCommissions()
      ]);

      if (totalRevenue === 0) return 0;

      // Simple profitability calculation
      const profitMargin = ((totalRevenue - totalCommissions) / totalRevenue) * 100;

      if (profitMargin > 20) return 100;
      else if (profitMargin > 15) return 85;
      else if (profitMargin > 10) return 70;
      else if (profitMargin > 5) return 55;
      else if (profitMargin > 0) return 40;
      else return 20;
    } catch (error) {
      console.error('Failed to calculate financial score:', error);
      return 0;
    }
  }

  private generateHealthRecommendations(components: any): string[] {
    const recommendations: string[] = [];

    if (components.growth < 60) {
      recommendations.push('Implement member acquisition campaigns');
      recommendations.push('Launch targeted marketing initiatives');
    }

    if (components.retention < 70) {
      recommendations.push('Launch member engagement program');
      recommendations.push('Implement regular check-in system');
    }

    if (components.productivity < 60) {
      recommendations.push('Enhance training and support systems');
      recommendations.push('Streamline commission calculation processes');
    }

    if (components.compliance < 80) {
      recommendations.push('Review and strengthen compliance procedures');
    }

    if (components.financial < 70) {
      recommendations.push('Optimize commission structure for sustainability');
    }

    return recommendations;
  }
}

// Export singleton instance
let analyticsEngineInstance: AnalyticsEngine | null = null;

function getAnalyticsEngine(): AnalyticsEngine {
  if (!analyticsEngineInstance) {
    analyticsEngineInstance = new AnalyticsEngine();
  }
  return analyticsEngineInstance;
}

// Server actions for API routes
export async function getKeyMetricsServer(period: 'day' | 'week' | 'month' | 'quarter' = 'month'): Promise<AnalyticsMetric[]> {
  try {
    const engine = getAnalyticsEngine();
    return await engine.getKeyMetrics(period);
  } catch (error) {
    console.error('Failed to get key metrics:', error);
    return [];
  }
}

export async function getGrowthAnalyticsServer(period: string = '30d'): Promise<GrowthAnalytics> {
  try {
    const engine = getAnalyticsEngine();
    return await engine.getGrowthAnalytics(period);
  } catch (error) {
    console.error('Failed to get growth analytics:', error);
    throw error;
  }
}

export async function getBusinessHealthScoreServer(): Promise<BusinessHealthScore> {
  try {
    const engine = getAnalyticsEngine();
    return await engine.getBusinessHealthScore();
  } catch (error) {
    console.error('Failed to get business health score:', error);
    throw error;
  }
}

export async function predictMemberCommission(memberId: string, monthsAhead: number = 3): Promise<any> {
  const engine = getAnalyticsEngine();
  return engine.predictMemberCommission(memberId, monthsAhead);
}

// Health check for load balancer
export async function healthCheck(): Promise<{ status: string; timestamp: string; cacheSize: number }> {
  try {
    await db.$queryRaw`SELECT 1`;
    const engine = getAnalyticsEngine();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cacheSize: engine['cache'].size,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      cacheSize: 0,
    };
  }
}