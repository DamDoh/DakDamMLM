import type { BusinessRule } from '@/lib/types';

export interface PerformanceMetrics {
  ruleId: string;
  executionCount: number;
  totalExecutionTime: number;
  errorCount: number;
  lastExecution: Date;
  averageExecutionTime: number;
  successRate: number;
  peakExecutionTime: number;
  minExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
}

export interface PerformanceReport {
  generatedAt: Date;
  totalRules: number;
  totalExecutions: number;
  totalErrors: number;
  overallSuccessRate: number;
  averageExecutionTime: number;
  slowRules: PerformanceMetrics[];
  failingRules: PerformanceMetrics[];
  unusedRules: PerformanceMetrics[];
  performanceByCategory: Record<string, {
    count: number;
    avgExecutionTime: number;
    successRate: number;
  }>;
}

export class RulePerformanceMonitor {
  private metrics = new Map<string, {
    executionCount: number;
    totalExecutionTime: number;
    errorCount: number;
    lastExecution: Date;
    executionTimes: number[];
    peakExecutionTime: number;
    minExecutionTime: number;
  }>();

  private readonly PERFECT_SUCCESS_RATE = 100;
  private readonly GOOD_SUCCESS_RATE = 95;
  private readonly ACCEPTABLE_SUCCESS_RATE = 90;

  /**
   * Track rule execution performance
   */
  trackExecution(
    ruleId: string,
    executionTime: number,
    success: boolean
  ): void {
    const current = this.metrics.get(ruleId) || {
      executionCount: 0,
      totalExecutionTime: 0,
      errorCount: 0,
      lastExecution: new Date(),
      executionTimes: [],
      peakExecutionTime: 0,
      minExecutionTime: Infinity
    };

    current.executionCount++;
    current.totalExecutionTime += executionTime;
    if (!success) current.errorCount++;
    current.lastExecution = new Date();
    current.executionTimes.push(executionTime);

    // Keep only last 1000 execution times for memory efficiency
    if (current.executionTimes.length > 1000) {
      current.executionTimes = current.executionTimes.slice(-1000);
    }

    // Update peak and min
    current.peakExecutionTime = Math.max(current.peakExecutionTime, executionTime);
    current.minExecutionTime = Math.min(current.minExecutionTime, executionTime);

    this.metrics.set(ruleId, current);
  }

  /**
   * Get performance metrics for a specific rule
   */
  getMetrics(ruleId?: string): PerformanceMetrics | PerformanceMetrics[] | null {
    if (ruleId) {
      const metric = this.metrics.get(ruleId);
      return metric ? this.calculateMetrics(ruleId, metric) : null;
    }

    // Return all metrics
    const allMetrics: PerformanceMetrics[] = [];
    for (const [id, metric] of this.metrics) {
      allMetrics.push(this.calculateMetrics(id, metric));
    }

    return allMetrics;
  }

  /**
   * Calculate derived metrics
   */
  private calculateMetrics(ruleId: string, data: any): PerformanceMetrics {
    const averageExecutionTime = data.executionCount > 0 ? data.totalExecutionTime / data.executionCount : 0;
    const successRate = data.executionCount > 0 ? ((data.executionCount - data.errorCount) / data.executionCount) * 100 : 100;

    // Calculate percentiles
    const sortedTimes = [...data.executionTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      ruleId,
      executionCount: data.executionCount,
      totalExecutionTime: data.totalExecutionTime,
      errorCount: data.errorCount,
      lastExecution: data.lastExecution,
      averageExecutionTime,
      successRate,
      peakExecutionTime: data.peakExecutionTime,
      minExecutionTime: data.minExecutionTime === Infinity ? 0 : data.minExecutionTime,
      p95ExecutionTime: sortedTimes[p95Index] || 0,
      p99ExecutionTime: sortedTimes[p99Index] || 0
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(rules?: BusinessRule[]): PerformanceReport {
    const allMetrics = this.getMetrics() as PerformanceMetrics[];
    const reportMetrics = rules
      ? allMetrics.filter(m => rules.some(r => r.id === m.ruleId))
      : allMetrics;

    const totalExecutions = reportMetrics.reduce((sum, m) => sum + m.executionCount, 0);
    const totalErrors = reportMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const overallSuccessRate = totalExecutions > 0 ? ((totalExecutions - totalErrors) / totalExecutions) * 100 : 100;
    const averageExecutionTime = reportMetrics.length > 0
      ? reportMetrics.reduce((sum, m) => sum + m.averageExecutionTime, 0) / reportMetrics.length
      : 0;

    // Performance by category (if rules provided)
    const performanceByCategory: Record<string, any> = {};
    if (rules) {
      const categoryMap = new Map(rules.map(r => [r.id, r.category]));
      reportMetrics.forEach(metric => {
        const category = categoryMap.get(metric.ruleId) || 'unknown';
        if (!performanceByCategory[category]) {
          performanceByCategory[category] = {
            count: 0,
            totalExecutionTime: 0,
            totalExecutions: 0,
            totalErrors: 0
          };
        }
        const cat = performanceByCategory[category];
        cat.count++;
        cat.totalExecutionTime += metric.totalExecutionTime;
        cat.totalExecutions += metric.executionCount;
        cat.totalErrors += metric.errorCount;
      });

      // Calculate averages
      Object.keys(performanceByCategory).forEach(category => {
        const cat = performanceByCategory[category];
        cat.avgExecutionTime = cat.totalExecutions > 0 ? cat.totalExecutionTime / cat.totalExecutions : 0;
        cat.successRate = cat.totalExecutions > 0 ? ((cat.totalExecutions - cat.totalErrors) / cat.totalExecutions) * 100 : 100;
      });
    }

    return {
      generatedAt: new Date(),
      totalRules: reportMetrics.length,
      totalExecutions,
      totalErrors,
      overallSuccessRate,
      averageExecutionTime,
      slowRules: this.getSlowRules(100, reportMetrics),
      failingRules: this.getFailingRules(this.ACCEPTABLE_SUCCESS_RATE, reportMetrics),
      unusedRules: this.getUnusedRules(30, reportMetrics),
      performanceByCategory
    };
  }

  /**
   * Get rules with slow execution times
   */
  getSlowRules(thresholdMs: number = 100, metrics?: PerformanceMetrics[]): PerformanceMetrics[] {
    const targetMetrics = metrics || (this.getMetrics() as PerformanceMetrics[]);
    return targetMetrics
      .filter(m => m.averageExecutionTime > thresholdMs)
      .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime);
  }

  /**
   * Get rules with low success rates
   */
  getFailingRules(thresholdPercent: number = 90, metrics?: PerformanceMetrics[]): PerformanceMetrics[] {
    const targetMetrics = metrics || (this.getMetrics() as PerformanceMetrics[]);
    return targetMetrics
      .filter(m => m.successRate < thresholdPercent)
      .sort((a, b) => a.successRate - b.successRate);
  }

  /**
   * Get rules that haven't been executed recently
   */
  getUnusedRules(days: number = 30, metrics?: PerformanceMetrics[]): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const targetMetrics = metrics || (this.getMetrics() as PerformanceMetrics[]);
    return targetMetrics
      .filter(m => m.lastExecution < cutoff)
      .sort((a, b) => a.lastExecution.getTime() - b.lastExecution.getTime());
  }

  /**
   * Get performance summary as text
   */
  getPerformanceSummary(): string {
    const report = this.generatePerformanceReport();

    let summary = '# Rule Performance Summary\n\n';
    summary += `Generated: ${report.generatedAt.toISOString()}\n\n`;
    summary += `## Overview\n\n`;
    summary += `- Total Rules Monitored: ${report.totalRules}\n`;
    summary += `- Total Executions: ${report.totalExecutions}\n`;
    summary += `- Overall Success Rate: ${report.overallSuccessRate.toFixed(1)}%\n`;
    summary += `- Average Execution Time: ${report.averageExecutionTime.toFixed(2)}ms\n\n`;

    if (report.slowRules.length > 0) {
      summary += `## Slow Rules (>${100}ms avg)\n\n`;
      report.slowRules.slice(0, 10).forEach(rule => {
        summary += `- ${rule.ruleId}: ${rule.averageExecutionTime.toFixed(2)}ms (${rule.executionCount} executions)\n`;
      });
      summary += '\n';
    }

    if (report.failingRules.length > 0) {
      summary += `## Failing Rules (<${this.ACCEPTABLE_SUCCESS_RATE}% success)\n\n`;
      report.failingRules.forEach(rule => {
        summary += `- ${rule.ruleId}: ${rule.successRate.toFixed(1)}% success (${rule.errorCount} errors)\n`;
      });
      summary += '\n';
    }

    if (report.unusedRules.length > 0) {
      summary += `## Unused Rules (>30 days)\n\n`;
      report.unusedRules.slice(0, 10).forEach(rule => {
        summary += `- ${rule.ruleId}: Last executed ${rule.lastExecution.toISOString().split('T')[0]}\n`;
      });
      summary += '\n';
    }

    return summary;
  }

  /**
   * Export performance data as JSON
   */
  exportPerformanceData(): string {
    const report = this.generatePerformanceReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Reset metrics for a specific rule or all rules
   */
  resetMetrics(ruleId?: string): void {
    if (ruleId) {
      this.metrics.delete(ruleId);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Get health score for the rule system
   */
  getHealthScore(): {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    issues: string[];
  } {
    const report = this.generatePerformanceReport();
    let score = 100;
    const issues: string[] = [];

    // Deduct points for various issues
    if (report.overallSuccessRate < this.PERFECT_SUCCESS_RATE) {
      const deduction = (this.PERFECT_SUCCESS_RATE - report.overallSuccessRate) * 2;
      score -= deduction;
      issues.push(`Low success rate: ${report.overallSuccessRate.toFixed(1)}%`);
    }

    if (report.slowRules.length > 0) {
      score -= Math.min(20, report.slowRules.length * 2);
      issues.push(`${report.slowRules.length} slow rules detected`);
    }

    if (report.failingRules.length > 0) {
      score -= Math.min(30, report.failingRules.length * 5);
      issues.push(`${report.failingRules.length} failing rules detected`);
    }

    if (report.unusedRules.length > report.totalRules * 0.5) {
      score -= 10;
      issues.push('Many rules are unused');
    }

    // Determine status
    let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    if (score >= 90) status = 'excellent';
    else if (score >= 80) status = 'good';
    else if (score >= 70) status = 'fair';
    else if (score >= 60) status = 'poor';
    else status = 'critical';

    return {
      score: Math.max(0, Math.min(100, score)),
      status,
      issues
    };
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(): Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    ruleId?: string;
  }> {
    const alerts: Array<any> = [];
    const allMetrics = this.getMetrics() as PerformanceMetrics[];

    allMetrics.forEach(metric => {
      // Critical alerts
      if (metric.successRate < 50) {
        alerts.push({
          level: 'critical',
          message: `Rule ${metric.ruleId} has very low success rate: ${metric.successRate.toFixed(1)}%`,
          ruleId: metric.ruleId
        });
      }

      // Error alerts
      if (metric.errorCount > metric.executionCount * 0.1) {
        alerts.push({
          level: 'error',
          message: `Rule ${metric.ruleId} has high error rate: ${metric.errorCount} errors`,
          ruleId: metric.ruleId
        });
      }

      // Warning alerts
      if (metric.averageExecutionTime > 500) {
        alerts.push({
          level: 'warning',
          message: `Rule ${metric.ruleId} is slow: ${metric.averageExecutionTime.toFixed(2)}ms average`,
          ruleId: metric.ruleId
        });
      }

      // Info alerts
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (metric.lastExecution < thirtyDaysAgo) {
        alerts.push({
          level: 'info',
          message: `Rule ${metric.ruleId} hasn't been executed recently`,
          ruleId: metric.ruleId
        });
      }
    });

    return alerts.sort((a, b) => {
      const levelOrder = { critical: 4, error: 3, warning: 2, info: 1 };
      return levelOrder[b.level as keyof typeof levelOrder] - levelOrder[a.level as keyof typeof levelOrder];
    });
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(hours: number = 24): {
    timePoints: Date[];
    successRates: number[];
    executionTimes: number[];
    errorRates: number[];
  } {
    // This would require storing historical data
    // For now, return current snapshot
    const report = this.generatePerformanceReport();

    return {
      timePoints: [report.generatedAt],
      successRates: [report.overallSuccessRate],
      executionTimes: [report.averageExecutionTime],
      errorRates: [report.totalErrors / Math.max(1, report.totalExecutions) * 100]
    };
  }
}

// Global instance
export const performanceMonitor = new RulePerformanceMonitor();