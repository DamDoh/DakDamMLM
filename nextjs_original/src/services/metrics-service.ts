import { MemberMetrics } from './metrics/member-metrics';
import { CommissionMetrics } from './metrics/commission-metrics';
import { OrderMetrics } from './metrics/order-metrics';
import { FinancialMetrics } from './metrics/financial-metrics';
import { HealthScoreCalculator } from './metrics/health-score-calculator';

interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
  category: 'members' | 'commissions' | 'orders' | 'retention' | 'productivity';
}

interface GrowthAnalytics {
  period: string;
  newMembers: number;
  activeMembers: number;
  totalMembers: number;
  retentionRate: number;
  churnRate: number;
  averageOrderValue: number;
  totalVolume: number;
  topPerformers: {
    memberId: string;
    name: string;
    volume: number;
    growth: number;
  }[];
}

interface BusinessHealthScore {
  overall: number; // 0-100
  components: {
    growth: number;
    retention: number;
    productivity: number;
    compliance: number;
    financial: number;
  };
  trends: {
    growth: 'improving' | 'declining' | 'stable';
    retention: 'improving' | 'declining' | 'stable';
    productivity: 'improving' | 'declining' | 'stable';
  };
  recommendations: string[];
}

export class MetricsService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private memberMetrics: MemberMetrics;
  private commissionMetrics: CommissionMetrics;
  private orderMetrics: OrderMetrics;
  private financialMetrics: FinancialMetrics;
  private healthCalculator: HealthScoreCalculator;

  constructor() {
    this.memberMetrics = new MemberMetrics();
    this.commissionMetrics = new CommissionMetrics();
    this.orderMetrics = new OrderMetrics();
    this.financialMetrics = new FinancialMetrics();
    this.healthCalculator = new HealthScoreCalculator();
  }

  async getKeyMetrics(period: 'day' | 'week' | 'month' | 'quarter' = 'month'): Promise<AnalyticsMetric[]> {
    const cacheKey = `metrics-${period}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const metrics: AnalyticsMetric[] = [];

      // Total Members
      const totalMembers = await this.memberMetrics.getTotalMembers();
      metrics.push({
        id: 'total-members',
        name: 'Total Members',
        value: totalMembers,
        category: 'members',
        trend: 'up',
        period
      });

      // Active Members
      const activeMembers = await this.memberMetrics.getActiveMembers();
      metrics.push({
        id: 'active-members',
        name: 'Active Members',
        value: activeMembers,
        category: 'members',
        trend: 'up',
        period
      });

      // Total Commissions
      const totalCommissions = await this.commissionMetrics.getTotalCommissions();
      metrics.push({
        id: 'total-commissions',
        name: 'Total Commissions',
        value: totalCommissions,
        category: 'commissions',
        trend: 'up',
        period
      });

      // Average Order Value
      const avgOrderValue = await this.orderMetrics.getAverageOrderValue();
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

      this.setCachedData(cacheKey, metrics, 300000); // 5 minutes cache
      return metrics;
    } catch (error) {
      console.error('Failed to get key metrics:', error);
      return [];
    }
  }

  async getGrowthAnalytics(period: string = '30d'): Promise<GrowthAnalytics> {
    const cacheKey = `growth-${period}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [newMembers, activeMembers, totalMembers, retentionRate, topPerformers, avgOrderValue, totalVolume] = await Promise.all([
        this.memberMetrics.getNewMembersSince(startDate),
        this.memberMetrics.getActiveMembers(),
        this.memberMetrics.getTotalMembers(),
        this.getRetentionRate(),
        this.memberMetrics.getTopPerformers(10),
        this.orderMetrics.getAverageOrderValue(),
        this.orderMetrics.getTotalVolume(),
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

      this.setCachedData(cacheKey, analytics, 600000); // 10 minutes cache
      return analytics;
    } catch (error) {
      console.error('Failed to get growth analytics:', error);
      throw error;
    }
  }

  async getBusinessHealthScore(): Promise<BusinessHealthScore> {
    try {
      const metrics = await this.getKeyMetrics('month');

      // Calculate component scores
      const growth = this.healthCalculator.calculateGrowthScore(metrics);
      const retention = this.healthCalculator.calculateRetentionScore(metrics);
      const productivity = this.healthCalculator.calculateProductivityScore(metrics);
      const compliance = await this.financialMetrics.calculateComplianceScore();
      const financial = await this.financialMetrics.calculateFinancialScore();

      const overall = Math.round((growth + retention + productivity + compliance + financial) / 5);

      // Determine trends
      const trends: BusinessHealthScore['trends'] = {
        growth: growth > 70 ? 'improving' : growth < 50 ? 'declining' : 'stable',
        retention: retention > 75 ? 'improving' : retention < 60 ? 'declining' : 'stable',
        productivity: productivity > 70 ? 'improving' : productivity < 50 ? 'declining' : 'stable'
      };

      // Generate recommendations
      const recommendations = this.healthCalculator.generateHealthRecommendations({
        growth,
        retention,
        productivity,
        compliance,
        financial
      });

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
      console.error('Failed to get business health score:', error);
      throw error;
    }
  }

  // Helper methods
  private async getRetentionRate(): Promise<number> {
    const totalMembers = await this.memberMetrics.getTotalMembers();
    if (totalMembers === 0) return 0;
    const activeMembers = await this.memberMetrics.getActiveMembers();
    return Math.round((activeMembers / totalMembers) * 100);
  }

  private getCachedData(key: string): any {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  private setCachedData(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + ttlMs);
  }
}