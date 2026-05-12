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

export class HealthScoreCalculator {
  calculateGrowthScore(metrics: AnalyticsMetric[]): number {
    const memberMetrics = metrics.find(m => m.id === 'total-members');
    const activeMetrics = metrics.find(m => m.id === 'active-members');

    if (!memberMetrics || !activeMetrics || memberMetrics.value === 0) return 0;

    const growthRate = (activeMetrics.value / memberMetrics.value) * 100;
    return Math.min(growthRate, 100);
  }

  calculateRetentionScore(metrics: AnalyticsMetric[]): number {
    const retentionMetric = metrics.find(m => m.id === 'retention-rate');
    return retentionMetric?.value || 0;
  }

  calculateProductivityScore(metrics: AnalyticsMetric[]): number {
    const commissionMetric = metrics.find(m => m.id === 'total-commissions');
    const avgOrderMetric = metrics.find(m => m.id === 'avg-order-value');

    if (!commissionMetric || !avgOrderMetric) return 0;

    // Simple productivity calculation
    const productivity = (commissionMetric.value / Math.max(avgOrderMetric.value, 1)) / 100;
    return Math.min(productivity, 100);
  }

  generateHealthRecommendations(components: BusinessHealthScore['components']): string[] {
    const recommendations: string[] = [];

    if (components.growth < 60) {
      recommendations.push('Implement member acquisition campaigns');
      recommendations.push('Launch targeted marketing initiatives');
      recommendations.push('Partner with existing members for referrals');
    }

    if (components.retention < 70) {
      recommendations.push('Launch member engagement program');
      recommendations.push('Implement regular check-in system');
      recommendations.push('Create loyalty rewards program');
    }

    if (components.productivity < 60) {
      recommendations.push('Enhance training and support systems');
      recommendations.push('Streamline commission calculation processes');
      recommendations.push('Implement performance tracking dashboards');
    }

    if (components.compliance < 80) {
      recommendations.push('Review and strengthen compliance procedures');
      recommendations.push('Conduct compliance training sessions');
      recommendations.push('Implement automated compliance monitoring');
    }

    if (components.financial < 70) {
      recommendations.push('Optimize commission structure for sustainability');
      recommendations.push('Implement cost control measures');
      recommendations.push('Diversify revenue streams');
      recommendations.push('Conduct financial health assessment');
    }

    return recommendations;
  }
}