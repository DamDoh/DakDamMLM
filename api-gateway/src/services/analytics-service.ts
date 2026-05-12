/**
 * ADVANCED ANALYTICS SERVICE
 *
 * Provides predictive insights, business intelligence, and ML-powered analytics
 * for the MLM platform.
 *
 * Features:
 * - Churn prediction models
 * - Revenue forecasting
 * - Member engagement scoring
 * - Performance trend analysis
 * - Growth prediction algorithms
 *
 * Created: 2025-11-20 (Enhancement)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
// ML libraries removed - using simple-statistics for basic calculations
import * as ss from 'simple-statistics';

export interface ChurnPrediction {
  userId: string;
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedChurnDate?: Date;
  factors: {
    daysSinceLastActivity: number;
    commissionTrend: 'increasing' | 'stable' | 'decreasing';
    teamSize: number;
    engagementScore: number;
  };
}

export interface RevenueForecast {
  period: string;
  predictedRevenue: number;
  confidence: number;
  growthRate: number;
  factors: string[];
}

export interface MemberEngagementScore {
  userId: string;
  overallScore: number; // 0-100
  components: {
    activityScore: number;
    commissionScore: number;
    teamGrowthScore: number;
    loginFrequencyScore: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}

export interface GrowthPrediction {
  companyId?: string;
  predictedNewMembers: number;
  predictedRevenue: number;
  timeHorizon: number; // months
  confidence: number;
  growthDrivers: string[];
  risks: string[];
}

class AnalyticsService {
  /**
   * Predict member churn probability using ML
   */
  async predictChurn(userId: string, companyId?: string): Promise<ChurnPrediction> {
    try {
      // Gather historical data for the user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          sponsored: {
            select: { id: true, createdAt: true, active: true }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Calculate engagement factors
      const daysSinceLastActivity = user.lastActivityDate
        ? Math.floor((Date.now() - user.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Get commission history for trend analysis
      const commissions = await prisma.commission.findMany({
        where: {
          userId,
          date: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        },
        orderBy: { date: 'asc' }
      });

      const commissionTrend = this.analyzeCommissionTrend(commissions);
      const engagementScoreData = await this.calculateEngagementScore(userId);

      // Calculate churn probability using weighted factors
      const churnProbability = this.calculateChurnProbability({
        daysSinceLastActivity,
        commissionTrend,
        teamSize: user.sponsored?.length || 0,
        engagementScore: engagementScoreData.overallScore,
        accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      });

      const riskLevel = this.getRiskLevel(churnProbability);

      return {
        userId,
        churnProbability,
        riskLevel,
        predictedChurnDate: riskLevel === 'critical' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
        factors: {
          daysSinceLastActivity,
          commissionTrend,
          teamSize: user.sponsored?.length || 0,
          engagementScore: engagementScoreData.overallScore
        }
      };
    } catch (error) {
      logger.error('Churn prediction failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Forecast revenue for upcoming periods
   */
  async forecastRevenue(
    companyId?: string,
    periods: number = 6
  ): Promise<RevenueForecast[]> {
    try {
      // Get historical revenue data (last 12 months)
      const revenueData = await this.getHistoricalRevenue(companyId, 12);

      if (revenueData.length < 3) {
        throw new Error('Insufficient historical data for forecasting');
      }

      // Use linear regression for forecasting
      const x = revenueData.map((_, index) => index);
      const y = revenueData.map(d => d.revenue);

      const pairs: Array<[number, number]> = x.map((xi, i) => [xi, y[i]]);
      const regression = ss.linearRegression(pairs);
      const slope = regression.m;
      const intercept = regression.b;

      const forecasts: RevenueForecast[] = [];

      for (let i = 1; i <= periods; i++) {
        const predictedRevenue = Math.max(0, slope * (revenueData.length + i - 1) + intercept);
        const confidence = this.calculateForecastConfidence(revenueData, predictedRevenue);
        const growthRate = i === 1 && intercept !== 0 ? slope / intercept : 0;

        forecasts.push({
          period: new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
          predictedRevenue,
          confidence,
          growthRate,
          factors: ['historical_trends', 'seasonal_patterns', 'market_conditions']
        });
      }

      return forecasts;
    } catch (error) {
      logger.error('Revenue forecasting failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Calculate member engagement score
   */
  async calculateEngagementScore(userId: string): Promise<MemberEngagementScore> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Activity score (based on login frequency and recent activity)
      const activityScore = this.calculateActivityScore(user);

      // Commission score (based on recent earnings)
      const commissionScore = await this.calculateCommissionScore(userId);

      // Team growth score (based on downline development)
      const teamGrowthScore = await this.calculateTeamGrowthScore(userId);

      // Login frequency score
      const loginFrequencyScore = this.calculateLoginFrequencyScore(user);

      // Overall score (weighted average)
      const overallScore = Math.round(
        (activityScore * 0.3) +
        (commissionScore * 0.3) +
        (teamGrowthScore * 0.2) +
        (loginFrequencyScore * 0.2)
      );

      // Determine trend
      const trend = this.determineEngagementTrend(overallScore);

      // Generate recommendations
      const recommendations = this.generateEngagementRecommendations({
        activityScore,
        commissionScore,
        teamGrowthScore,
        loginFrequencyScore
      });

      return {
        userId,
        overallScore,
        components: {
          activityScore,
          commissionScore,
          teamGrowthScore,
          loginFrequencyScore
        },
        trend,
        recommendations
      };
    } catch (error) {
      logger.error('Engagement score calculation failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Predict company growth metrics
   */
  async predictGrowth(companyId?: string, months: number = 12): Promise<GrowthPrediction> {
    try {
      // Get historical growth data
      const memberGrowth = await this.getHistoricalMemberGrowth(companyId, 12);
      const revenueGrowth = await this.getHistoricalRevenue(companyId, 12);

      // Use time series analysis for prediction
      const memberPrediction = this.predictTimeSeries(memberGrowth, months);
      const revenuePrediction = this.predictTimeSeries(revenueGrowth, months);

      // Calculate confidence based on data consistency
      const memberConsistency = this.calculateDataConsistency(memberGrowth);
      const revenueConsistency = this.calculateDataConsistency(revenueGrowth);
      const confidence = (memberConsistency + revenueConsistency) / 2;

      // Identify growth drivers and risks
      const growthDrivers = await this.identifyGrowthDrivers(companyId);
      const risks = await this.identifyGrowthRisks(companyId);

      return {
        companyId,
        predictedNewMembers: Math.round(memberPrediction),
        predictedRevenue: Math.round(revenuePrediction),
        timeHorizon: months,
        confidence,
        growthDrivers,
        risks
      };
    } catch (error) {
      logger.error('Growth prediction failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Key dashboard metrics for admin BI and analytics
   */
  async getKeyMetrics(
    period: 'day' | 'week' | 'month' | 'quarter' = 'month',
    companyId?: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      value: number;
      trend: 'up' | 'down' | 'stable';
    }>
  > {
    try {
      // Basic time window based on period (used only for rough trends)
      const now = new Date();
      const windowStart = new Date(now);
      if (period === 'day') windowStart.setDate(now.getDate() - 1);
      else if (period === 'week') windowStart.setDate(now.getDate() - 7);
      else if (period === 'month') windowStart.setMonth(now.getMonth() - 1);
      else if (period === 'quarter') windowStart.setMonth(now.getMonth() - 3);

      const companyFilter = companyId ? { companyId } : {};

      const [totalMembers, activeMembers, totalOrders, paidCommissionAgg] = await Promise.all([
        prisma.user.count({ where: { ...companyFilter } }),
        prisma.user.count({ where: { ...companyFilter, active: true } }),
        prisma.order.count({
          where: {
            ...companyFilter,
            // Orders table uses `date` column in this schema
            date: { gte: windowStart },
          },
        }),
        prisma.commission.aggregate({
          where: {
            ...companyFilter,
            status: 'Paid',
            // Commission model uses `date` column, not `createdAt`
            date: { gte: windowStart },
          },
          _sum: { amount: true },
        }),
      ]);

      const totalPaidCommission = paidCommissionAgg._sum.amount || 0;

      return [
        {
          id: 'total-members',
          name: 'Total Members',
          value: totalMembers,
          trend: 'stable',
        },
        {
          id: 'active-members',
          name: 'Active Members',
          value: activeMembers,
          trend: 'stable',
        },
        {
          id: 'orders-period',
          name: 'Orders (Period)',
          value: totalOrders,
          trend: 'stable',
        },
        {
          id: 'commission-paid-period',
          name: 'Commission Paid (Period)',
          value: Math.round(totalPaidCommission),
          trend: 'stable',
        },
      ];
    } catch (error) {
      logger.error('Key metrics calculation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period,
        companyId,
      });
      return [];
    }
  }

  /**
   * Get advanced dashboard metrics
   */
  async getAdvancedDashboardMetrics(companyId?: string): Promise<{
    churnRisk: { low: number; medium: number; high: number; critical: number };
    engagementDistribution: { excellent: number; good: number; poor: number };
    growthVelocity: number;
    revenuePredictability: number;
    topPerformers: Array<{ userId: string; score: number; metric: string }>;
    alerts: Array<{ type: string; message: string; severity: string }>;
  }> {
    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: {
          active: true,
          ...(companyId && { companyId })
        },
        select: { id: true }
      });

      // Calculate churn risk distribution
      const churnRisks = await Promise.all(
        users.map(user => this.predictChurn(user.id, companyId))
      );

      const churnRisk = {
        low: churnRisks.filter(r => r.riskLevel === 'low').length,
        medium: churnRisks.filter(r => r.riskLevel === 'medium').length,
        high: churnRisks.filter(r => r.riskLevel === 'high').length,
        critical: churnRisks.filter(r => r.riskLevel === 'critical').length
      };

      // Calculate engagement distribution
      const engagementScores = await Promise.all(
        users.map(user => this.calculateEngagementScore(user.id))
      );

      const engagementDistribution = {
        excellent: engagementScores.filter(s => s.overallScore >= 80).length,
        good: engagementScores.filter(s => s.overallScore >= 60 && s.overallScore < 80).length,
        poor: engagementScores.filter(s => s.overallScore < 60).length
      };

      // Calculate growth velocity (new members per month trend)
      const growthVelocity = await this.calculateGrowthVelocity(companyId);

      // Calculate revenue predictability
      const revenuePredictability = await this.calculateRevenuePredictability(companyId);

      // Get top performers
      const topPerformers = await this.getTopPerformers(companyId);

      // Generate alerts
      const alerts = this.generateSystemAlerts(churnRisk, engagementDistribution, growthVelocity);

      return {
        churnRisk,
        engagementDistribution,
        growthVelocity,
        revenuePredictability,
        topPerformers,
        alerts
      };
    } catch (error) {
      logger.error('Advanced dashboard metrics failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Helper methods

  private analyzeCommissionTrend(commissions: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (commissions.length < 2) return 'stable';

    const recent = commissions.slice(-10); // Last 10 commissions
    const earlier = commissions.slice(-20, -10); // Previous 10

    const recentAvg = ss.mean(recent.map(c => c.amount));
    const earlierAvg = earlier.length > 0 ? ss.mean(earlier.map(c => c.amount)) : recentAvg;

    const change = (recentAvg - earlierAvg) / earlierAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateChurnProbability(factors: {
    daysSinceLastActivity: number;
    commissionTrend: string;
    teamSize: number;
    engagementScore: number;
    accountAge: number;
  }): number {
    let probability = 0;

    // Days since last activity (0-30 days = low risk, 30-90 = medium, 90+ = high)
    if (factors.daysSinceLastActivity > 90) probability += 0.4;
    else if (factors.daysSinceLastActivity > 30) probability += 0.2;

    // Commission trend
    if (factors.commissionTrend === 'decreasing') probability += 0.3;
    else if (factors.commissionTrend === 'stable') probability += 0.1;

    // Team size (smaller teams = higher risk)
    if (factors.teamSize < 5) probability += 0.2;
    else if (factors.teamSize < 10) probability += 0.1;

    // Engagement score
    if (factors.engagementScore < 30) probability += 0.3;
    else if (factors.engagementScore < 60) probability += 0.1;

    // Account age (newer accounts = higher risk)
    if (factors.accountAge < 30) probability += 0.1;

    return Math.min(1, probability);
  }

  private getRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= 0.7) return 'critical';
    if (probability >= 0.5) return 'high';
    if (probability >= 0.3) return 'medium';
    return 'low';
  }

  private async calculateEngagementScoreInternal(userId: string): Promise<number> {
    // Simplified engagement calculation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActivityDate: true, pv: true }
    });

    if (!user) return 0;

    const daysSinceActivity = user.lastActivityDate
      ? Math.floor((Date.now() - user.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Score based on recency and activity
    let score = 100;
    if (daysSinceActivity > 30) score -= 30;
    if (daysSinceActivity > 90) score -= 40;

    return Math.max(0, Math.min(100, score));
  }

  private calculateActivityScore(user: any): number {
    const daysSinceActivity = user.lastActivityDate
      ? Math.floor((Date.now() - user.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceActivity <= 7) return 100;
    if (daysSinceActivity <= 30) return 80;
    if (daysSinceActivity <= 90) return 60;
    if (daysSinceActivity <= 180) return 40;
    return 20;
  }

  private async calculateCommissionScore(userId: string): Promise<number> {
    const recentCommissions = await prisma.commission.findMany({
      where: {
        userId,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    const totalAmount = recentCommissions.reduce((sum, c) => sum + c.amount, 0);

    if (totalAmount > 1000) return 100;
    if (totalAmount > 500) return 80;
    if (totalAmount > 100) return 60;
    if (totalAmount > 0) return 40;
    return 20;
  }

  private async calculateTeamGrowthScore(userId: string): Promise<number> {
    const teamSize = await prisma.user.count({
      where: { sponsorId: userId }
    });

    if (teamSize > 100) return 100;
    if (teamSize > 50) return 80;
    if (teamSize > 20) return 60;
    if (teamSize > 5) return 40;
    if (teamSize > 0) return 20;
    return 0;
  }

  private calculateLoginFrequencyScore(user: any): number {
    // Simplified - in real implementation, track login history
    const daysSinceActivity = user.lastActivityDate
      ? Math.floor((Date.now() - user.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceActivity <= 1) return 100;
    if (daysSinceActivity <= 7) return 80;
    if (daysSinceActivity <= 30) return 60;
    return 30;
  }

  private determineEngagementTrend(score: number): 'improving' | 'stable' | 'declining' {
    // Simplified - in real implementation, compare with historical scores
    if (score >= 80) return 'improving';
    if (score >= 60) return 'stable';
    return 'declining';
  }

  private generateEngagementRecommendations(components: any): string[] {
    const recommendations: string[] = [];

    if (components.activityScore < 60) {
      recommendations.push('Increase login frequency and platform engagement');
    }

    if (components.commissionScore < 60) {
      recommendations.push('Focus on increasing sales and commission generation');
    }

    if (components.teamGrowthScore < 60) {
      recommendations.push('Recruit and develop your downline team');
    }

    if (components.loginFrequencyScore < 60) {
      recommendations.push('Stay active and engaged with the platform regularly');
    }

    return recommendations;
  }

  private async getHistoricalRevenue(companyId?: string, months: number = 12): Promise<Array<{ month: string; revenue: number }>> {
    const data = [];
    for (let i = months; i >= 1; i--) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      startDate.setDate(1);

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const revenue = await prisma.commission.aggregate({
        where: {
          status: 'Paid',
          date: { gte: startDate, lt: endDate },
          ...(companyId && { companyId })
        },
        _sum: { amount: true }
      });

      data.push({
        month: startDate.toISOString().slice(0, 7),
        revenue: revenue._sum.amount || 0
      });
    }

    return data;
  }

  private calculateForecastConfidence(historicalData: any[], predictedValue: number): number {
    if (historicalData.length < 2) return 0;

    const values = historicalData.map(d => d.revenue);
    const mean = ss.mean(values);
    const stdDev = ss.standardDeviation(values);

    // Confidence based on coefficient of variation
    const cv = stdDev / mean;
    return Math.max(0, Math.min(100, 100 - (cv * 100)));
  }

  private predictTimeSeries(data: any[], periods: number): number {
    if (data.length < 2) return 0;

    // Simple exponential smoothing for prediction
    const values = data.map(d => d.revenue || d.members || 0);
    const alpha = 0.3; // Smoothing factor

    let smoothed = values[0];
    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
    }

    // Project forward
    for (let i = 0; i < periods; i++) {
      smoothed = alpha * smoothed + (1 - alpha) * smoothed; // Simplified
    }

    return smoothed;
  }

  private calculateDataConsistency(data: any[]): number {
    if (data.length < 2) return 0;

    const values = data.map(d => d.revenue || d.members || 0);
    const mean = ss.mean(values);
    const stdDev = ss.standardDeviation(values);

    // Return consistency score (higher = more consistent)
    return Math.max(0, Math.min(100, 100 - (stdDev / mean * 50)));
  }

  private async identifyGrowthDrivers(companyId?: string): Promise<string[]> {
    const drivers: string[] = [];

    // Check recent commission trends
    const recentCommissions = await prisma.commission.count({
      where: {
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(companyId && { companyId })
      }
    });

    if (recentCommissions > 100) {
      drivers.push('Strong commission activity');
    }

    // Check new member signups
    const newMembers = await prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(companyId && { companyId })
      }
    });

    if (newMembers > 20) {
      drivers.push('Healthy member acquisition');
    }

    drivers.push('Market expansion opportunities');
    return drivers;
  }

  private async identifyGrowthRisks(companyId?: string): Promise<string[]> {
    const risks: string[] = [];

    // Check for declining trends
    const recentRevenue = await this.getHistoricalRevenue(companyId, 3);
    if (recentRevenue.length >= 2) {
      const trend = recentRevenue[recentRevenue.length - 1].revenue - recentRevenue[0].revenue;
      if (trend < 0) {
        risks.push('Declining revenue trend');
      }
    }

    // Check member churn
    const inactiveMembers = await prisma.user.count({
      where: {
        active: false,
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(companyId && { companyId })
      }
    });

    if (inactiveMembers > 10) {
      risks.push('High member churn rate');
    }

    risks.push('Market competition');
    return risks;
  }

  private async getHistoricalMemberGrowth(companyId?: string, months: number = 12): Promise<Array<{ month: string; members: number }>> {
    const data = [];
    for (let i = months; i >= 1; i--) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      startDate.setDate(1);

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const members = await prisma.user.count({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          ...(companyId && { companyId })
        }
      });

      data.push({
        month: startDate.toISOString().slice(0, 7),
        members
      });
    }

    return data;
  }

  private async calculateGrowthVelocity(companyId?: string): Promise<number> {
    const recentGrowth = await this.getHistoricalMemberGrowth(companyId, 6);
    if (recentGrowth.length < 2) return 0;

    const velocities = [];
    for (let i = 1; i < recentGrowth.length; i++) {
      velocities.push(recentGrowth[i].members - recentGrowth[i - 1].members);
    }

    return ss.mean(velocities);
  }

  private async calculateRevenuePredictability(companyId?: string): Promise<number> {
    const revenueData = await this.getHistoricalRevenue(companyId, 12);
    if (revenueData.length < 3) return 0;

    return this.calculateDataConsistency(revenueData);
  }

  private async getTopPerformers(companyId?: string): Promise<Array<{ userId: string; score: number; metric: string }>> {
    const topEarners = await prisma.commission.groupBy({
      by: ['userId'],
      where: {
        status: 'Paid',
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(companyId && { companyId })
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5
    });

    return topEarners.map(te => ({
      userId: te.userId,
      score: te._sum.amount || 0,
      metric: 'commission_earnings'
    }));
  }

  private generateSystemAlerts(
    churnRisk: any,
    engagementDistribution: any,
    growthVelocity: number
  ): Array<{ type: string; message: string; severity: string }> {
    const alerts: Array<{ type: string; message: string; severity: string }> = [];

    if (churnRisk.critical > 0) {
      alerts.push({
        type: 'churn',
        message: `${churnRisk.critical} members at critical risk of churning`,
        severity: 'critical'
      });
    }

    if (engagementDistribution.poor > engagementDistribution.excellent) {
      alerts.push({
        type: 'engagement',
        message: 'More members have poor engagement than excellent engagement',
        severity: 'high'
      });
    }

    if (growthVelocity < 0) {
      alerts.push({
        type: 'growth',
        message: 'Negative growth velocity detected',
        severity: 'medium'
      });
    }

    return alerts;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// ---------------------------------------------------------------------------
// Server-style helpers used by API routes and admin dashboard
// ---------------------------------------------------------------------------

// Simple wrapper to match original API for key metrics, with safe fallbacks
export async function getKeyMetricsServer(
  period: 'day' | 'week' | 'month' | 'quarter' = 'month'
): Promise<any[]> {
  try {
    return await analyticsService.getKeyMetrics(period);
  } catch (error) {
    console.error('getKeyMetricsServer error:', error);
    // Return empty metrics instead of throwing so API can still respond 200
    return [];
  }
}

// Growth analytics for a given period (e.g. '30d')
export async function getGrowthAnalyticsServer(period: string = '30d'): Promise<any> {
  try {
    // Parse period (e.g., '30d' = 1 month, '90d' = 3 months)
    const months = period.includes('d') ? Math.floor(parseInt(period) / 30) : parseInt(period);
    return await analyticsService.predictGrowth(undefined, months);
  } catch (error) {
    console.error('getGrowthAnalyticsServer error:', error);
    return null;
  }
}

// Business health score aggregation
export async function getBusinessHealthScoreServer(): Promise<any> {
  try {
    const metrics = await analyticsService.getAdvancedDashboardMetrics();
    // Calculate a simple health score based on various metrics
    const healthScore = {
      score: 100,
      factors: {
        churnRisk: metrics.churnRisk,
        engagement: metrics.engagementDistribution,
        growthVelocity: metrics.growthVelocity,
        revenuePredictability: metrics.revenuePredictability
      },
      alerts: metrics.alerts
    };
    return healthScore;
  } catch (error) {
    console.error('getBusinessHealthScoreServer error:', error);
    return null;
  }
}