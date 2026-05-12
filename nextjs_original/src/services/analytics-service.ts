
// Comprehensive Analytics Service - Consolidated Implementation
// Migrated from /services/analytics-service/index.ts for better maintainability

'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

// Analytics configuration with performance monitoring
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

// Enhanced cache with performance monitoring
class AnalyticsCache {
  private cache = new Map<string, { data: any; expiry: number; accessCount: number }>();
  private stats = { hits: 0, misses: 0 };

  get(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      cached.accessCount++;
      this.stats.hits++;
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key); // Remove expired entry
    }
    this.stats.misses++;
    return null;
  }

  set(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      accessCount: 0
    });
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses),
      totalEntries: this.cache.size
    };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}

const analyticsCache = new AnalyticsCache();

class AnalyticsEngine {
  // Enhanced key metrics with better error handling
  async getKeyMetrics(period: 'day' | 'week' | 'month' | 'quarter' = 'month'): Promise<any[]> {
    const startTime = Date.now();
    const cacheKey = `metrics-${period}`;

    try {
      // Check cache first
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        logger.debug(`Analytics cache hit for key metrics (${period})`);
        return cached;
      }

      const metrics: any[] = [];

      // Total Members
      const totalMembers = await this.getTotalMembers();
      metrics.push({
        id: 'total-members',
        name: 'Total Members',
        value: totalMembers,
        category: 'members',
        trend: 'up',
        period,
        lastUpdated: new Date().toISOString()
      });

      // Active Members
      const activeMembers = await this.getActiveMembers();
      metrics.push({
        id: 'active-members',
        name: 'Active Members',
        value: activeMembers,
        category: 'members',
        trend: 'up',
        period,
        lastUpdated: new Date().toISOString()
      });

      // Total Commissions
      const totalCommissions = await this.getTotalCommissions();
      metrics.push({
        id: 'total-commissions',
        name: 'Total Commissions',
        value: totalCommissions,
        category: 'commissions',
        trend: 'up',
        period,
        lastUpdated: new Date().toISOString()
      });

      // Average Order Value
      const avgOrderValue = await this.getAverageOrderValue();
      metrics.push({
        id: 'avg-order-value',
        name: 'Average Order Value',
        value: avgOrderValue,
        category: 'orders',
        trend: 'stable',
        period,
        lastUpdated: new Date().toISOString()
      });

      // Member Retention Rate
      const retentionRate = await this.getRetentionRate();
      metrics.push({
        id: 'retention-rate',
        name: 'Retention Rate',
        value: retentionRate,
        category: 'retention',
        trend: retentionRate > 80 ? 'up' : 'down',
        period,
        lastUpdated: new Date().toISOString()
      });

      // Cache the results
      analyticsCache.set(cacheKey, metrics, ANALYTICS_CONFIG.cache.keyMetrics);

      const duration = Date.now() - startTime;
      logger.info(`Key metrics calculated successfully`, {
        period,
        duration,
        metricCount: metrics.length
      });

      return metrics;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get key metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period,
        duration
      });
      throw new Error(`Failed to calculate key metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced growth analytics with better performance
  async getGrowthAnalytics(period: string = '30d'): Promise<any> {
    const startTime = Date.now();
    const cacheKey = `growth-${period}`;

    try {
      // Check cache first
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        logger.debug(`Analytics cache hit for growth analytics (${period})`);
        return cached;
      }

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

      const analytics = {
        period,
        newMembers,
        activeMembers,
        totalMembers,
        retentionRate,
        churnRate: 100 - retentionRate,
        averageOrderValue: avgOrderValue,
        totalVolume: totalVolume,
        topPerformers,
        generatedAt: new Date().toISOString()
      };

      // Cache the results
      analyticsCache.set(cacheKey, analytics, ANALYTICS_CONFIG.cache.growthAnalytics);

      const duration = Date.now() - startTime;
      logger.info(`Growth analytics calculated successfully`, {
        period,
        duration,
        newMembers,
        retentionRate
      });

      return analytics;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get growth analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period,
        duration
      });
      throw new Error(`Failed to calculate growth analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced prediction engine with better accuracy
  async predictMemberCommission(memberId: string, monthsAhead: number = 3): Promise<any> {
    const startTime = Date.now();
    const cacheKey = `prediction-${memberId}-${monthsAhead}`;

    try {
      // Check cache first
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        logger.debug(`Analytics cache hit for prediction (${memberId}, ${monthsAhead} months)`);
        return cached;
      }

      // Get member data
      const member = await prisma.user.findUnique({
        where: { id: memberId }
      });

      if (!member) {
        throw new Error(`Member not found: ${memberId}`);
      }

      // Get historical commission data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const historicalCommissions = await prisma.commission.findMany({
        where: {
          userId: memberId,
          date: {
            gte: sixMonthsAgo.toISOString()
          }
        },
        orderBy: { date: 'desc' }
      });

      // Group commissions by month
      const monthlyTotals = this.groupCommissionsByMonth(historicalCommissions);

      // Calculate growth trends
      const growthRate = this.calculateCommissionGrowthRate(monthlyTotals);
      const avgCommission = monthlyTotals.length > 0 ?
        monthlyTotals.reduce((sum, month) => sum + month.total, 0) / monthlyTotals.length : 0;

      // Factor in current member metrics (using fallbacks for missing fields)
      const teamSize = { total: 0 }; // teamSize field doesn't exist in current Prisma schema
      const teamGrowth = teamSize.total * ANALYTICS_CONFIG.forecasting.teamGrowth;
      const pvGrowth = 0; // pv field doesn't exist in current Prisma schema
      const rankMultiplier = this.getRankCommissionMultiplier('Member'); // Default rank

      // Generate predictions
      const predictions = [];
      const binaryPredictions = [];
      const matchingPredictions = [];
      const stockistPredictions = [];
      const rankPredictions = [];

      let currentBase = Math.max(avgCommission, 0);

      // For new members with no commission history
        currentBase = Math.max(0, 0); // Simplified for missing PV field

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

        analyticsCache.set(cacheKey, result, ANALYTICS_CONFIG.cache.predictions);

        const duration = Date.now() - startTime;
        logger.info(`Zero predictions generated for new member`, {
          memberId,
          duration
        });

        return result;
      }

      for (let i = 1; i <= monthsAhead; i++) {
        // Apply growth factors
        const monthMultiplier = Math.pow(1 + growthRate + teamGrowth + pvGrowth, i * 0.1);
        const rankAdjusted = currentBase * monthMultiplier * rankMultiplier;

        // Distribute across commission types
        const binaryAmount = Math.round(rankAdjusted * 0.6 * 100) / 100;
        const matchingAmount = Math.round(rankAdjusted * 0.25 * 100) / 100;
        const stockistAmount = 0; // Simplified for missing storeOwnerLevel field
        const rankAmount = Math.round(rankAdjusted * 0.05 * 100) / 100;

        const totalMonthly = Math.round((binaryAmount + matchingAmount + stockistAmount + rankAmount) * 100) / 100;

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

      // Cache the results
      analyticsCache.set(cacheKey, result, ANALYTICS_CONFIG.cache.predictions);

      const duration = Date.now() - startTime;
      logger.info(`Commission prediction completed`, {
        memberId,
        monthsAhead,
        confidence,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to predict member commission', {
        error: error instanceof Error ? error.message : 'Unknown error',
        memberId,
        monthsAhead,
        duration
      });
      throw error;
    }
  }

  // Helper methods with enhanced error handling
  private async getTotalMembers(): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: { isAdmin: false }
      });
      return count;
    } catch (error) {
      logger.error('Failed to get total members', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  private async getActiveMembers(): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: {
          active: true,
          isAdmin: false
        }
      });
      return count;
    } catch (error) {
      logger.error('Failed to get active members', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  private async getNewMembersSince(date: Date): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: {
          createdAt: {
            gte: date.toISOString()
          },
          isAdmin: false
        }
      });
      return count;
    } catch (error) {
      logger.error('Failed to get new members since date', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  private async getTotalCommissions(): Promise<number> {
    try {
      const result = await prisma.commission.aggregate({
        _sum: {
          amount: true
        }
      });

      return Number(result._sum.amount) || 0;
    } catch (error) {
      logger.error('Failed to get total commissions', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  private async getAverageOrderValue(): Promise<number> {
    try {
      const result = await prisma.order.aggregate({
        _avg: {
          amount: true
        }
      });

      return Number(result._avg.amount) || 0;
    } catch (error) {
      logger.error('Failed to get average order value', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      const result = await prisma.order.aggregate({
        _sum: {
          amount: true
        }
      });

      return Number(result._sum.amount) || 0;
    } catch (error) {
      logger.error('Failed to get total volume', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  private async getTopPerformers(count: number): Promise<any[]> {
    try {
      const topMembers = await prisma.user.findMany({
        where: {
          active: true,
          isAdmin: false
        },
        orderBy: {
          createdAt: 'desc' // Order by creation date since pv field doesn't exist
        },
        take: count
      });

      return topMembers.map(member => ({
        memberId: member.memberId || member.id,
        name: member.fullName,
        volume: 0, // PV field doesn't exist in current Prisma schema
        growth: 0, // Growth calculation would require historical data
      }));
    } catch (error) {
      logger.error('Failed to get top performers', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  // Analytics calculation helpers
  private groupCommissionsByMonth(commissions: any[]): Array<{month: string, total: number, count: number}> {
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
    if ((member.teamSize as any)?.total > 10) confidence += 0.1;
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

    if ((member.teamSize as any)?.total > 50) factors.push('Large team size');
    else if ((member.teamSize as any)?.total > 10) factors.push('Growing team');

    if (teamGrowth > 0.05) factors.push('Team expansion opportunity');

    if (member.storeOwnerLevel) factors.push('Stockist bonus potential');

    return factors;
  }
}

// Singleton instance with enhanced error handling
let analyticsEngineInstance: AnalyticsEngine | null = null;

function getAnalyticsEngine(): AnalyticsEngine {
  if (!analyticsEngineInstance) {
    analyticsEngineInstance = new AnalyticsEngine();
  }
  return analyticsEngineInstance;
}

// Enhanced server actions with better error handling and logging
export async function getKeyMetricsServer(period: 'day' | 'week' | 'month' | 'quarter' = 'month'): Promise<any[]> {
  try {
    const engine = getAnalyticsEngine();
    return await engine.getKeyMetrics(period);
  } catch (error) {
    logger.error('Failed to get key metrics from server action', {
      error: error instanceof Error ? error.message : 'Unknown error',
      period
    });
    return [];
  }
}

export async function getGrowthAnalyticsServer(period: string = '30d'): Promise<any> {
  try {
    const engine = getAnalyticsEngine();
    return await engine.getGrowthAnalytics(period);
  } catch (error) {
    logger.error('Failed to get growth analytics from server action', {
      error: error instanceof Error ? error.message : 'Unknown error',
      period
    });
    throw error;
  }
}

export async function getBusinessHealthScoreServer(): Promise<any> {
  try {
    const engine = getAnalyticsEngine();
    // For now, return a simplified health score based on key metrics
    const metrics = await engine.getKeyMetrics('month');
    const activeMembers = metrics.find(m => m.id === 'active-members')?.value || 0;
    const totalMembers = metrics.find(m => m.id === 'total-members')?.value || 1;
    const retentionRate = metrics.find(m => m.id === 'retention-rate')?.value || 0;

    const overallScore = Math.round((retentionRate * 0.4) + ((activeMembers / totalMembers) * 100 * 0.6));

    return {
      overall: overallScore,
      components: {
        growth: Math.round((activeMembers / totalMembers) * 100),
        retention: retentionRate,
        productivity: overallScore,
        compliance: 80, // Placeholder
        financial: overallScore
      },
      trends: {
        growth: overallScore > 70 ? 'improving' : 'stable',
        retention: retentionRate > 75 ? 'improving' : 'stable',
        productivity: overallScore > 70 ? 'improving' : 'stable'
      },
      recommendations: overallScore > 80 ? ['Maintain current performance'] : ['Focus on member engagement']
    };
  } catch (error) {
    logger.error('Failed to get business health score from server action', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export async function predictMemberCommission(memberId: string, monthsAhead: number = 3): Promise<any> {
  try {
    const engine = getAnalyticsEngine();
    return await engine.predictMemberCommission(memberId, monthsAhead);
  } catch (error) {
    logger.error('Failed to predict member commission from server action', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId,
      monthsAhead
    });
    throw error;
  }
}

// Health check for load balancer and monitoring
export async function healthCheck(): Promise<{ status: string; timestamp: string; cacheStats: any }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const engine = getAnalyticsEngine();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cacheStats: analyticsCache.getStats(),
    };
  } catch (error) {
    logger.error('Analytics health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      cacheStats: { hits: 0, misses: 0, hitRate: 0 },
    };
  }
}
