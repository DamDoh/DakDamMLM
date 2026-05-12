import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import { logger } from './logger';

// Enable default metrics collection
collectDefaultMetrics({ prefix: 'commission_service_' });

// Custom metrics
const commissionsCalculatedTotal = new Counter({
  name: 'commission_service_commissions_calculated_total',
  help: 'Total number of commissions calculated',
  labelNames: ['type', 'level'],
});

const commissionCalculationDuration = new Histogram({
  name: 'commission_service_commission_calculation_duration_seconds',
  help: 'Duration of commission calculation in seconds',
  labelNames: ['order_count', 'levels_calculated'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const commissionsPaidTotal = new Counter({
  name: 'commission_service_commissions_paid_total',
  help: 'Total number of commissions paid',
  labelNames: ['method', 'status'],
});

const commissionAmountTotal = new Counter({
  name: 'commission_service_commission_amount_total',
  help: 'Total commission amounts processed',
  labelNames: ['type', 'currency'],
});

const payoutsProcessedTotal = new Counter({
  name: 'commission_service_payouts_processed_total',
  help: 'Total number of payouts processed',
  labelNames: ['method', 'status'],
});

const payoutProcessingDuration = new Histogram({
  name: 'commission_service_payout_processing_duration_seconds',
  help: 'Duration of payout processing in seconds',
  labelNames: ['method'],
  buckets: [1, 5, 10, 30, 60, 300],
});

const bonusesAchievedTotal = new Counter({
  name: 'commission_service_bonuses_achieved_total',
  help: 'Total number of bonuses achieved',
  labelNames: ['type', 'period'],
});

const activeCommissionRules = new Gauge({
  name: 'commission_service_active_commission_rules',
  help: 'Number of active commission rules',
});

const pendingCommissions = new Gauge({
  name: 'commission_service_pending_commissions',
  help: 'Number of pending commissions',
});

const pendingPayouts = new Gauge({
  name: 'commission_service_pending_payouts',
  help: 'Number of pending payouts',
});

// Performance monitoring
const requestDuration = new Summary({
  name: 'commission_service_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

class MetricsService {
  // Commission metrics
  recordCommissionCalculated(type: string, level: number) {
    commissionsCalculatedTotal.inc({ type, level: level.toString() });
  }

  startCommissionCalculationTimer(orderCount: number, levelsCalculated: number) {
    return commissionCalculationDuration.startTimer({ order_count: orderCount.toString(), levels_calculated: levelsCalculated.toString() });
  }

  recordCommissionPaid(method: string, status: 'success' | 'failed') {
    commissionsPaidTotal.inc({ method, status });
  }

  recordCommissionAmount(amount: number, type: string, currency: string = 'USD') {
    commissionAmountTotal.inc({ type, currency }, amount);
  }

  recordPayoutProcessed(method: string, status: 'success' | 'failed') {
    payoutsProcessedTotal.inc({ method, status });
  }

  startPayoutProcessingTimer(method: string) {
    return payoutProcessingDuration.startTimer({ method });
  }

  recordBonusAchieved(type: string, period: string) {
    bonusesAchievedTotal.inc({ type, period });
  }

  setActiveCommissionRules(count: number) {
    activeCommissionRules.set(count);
  }

  setPendingCommissions(count: number) {
    pendingCommissions.set(count);
  }

  setPendingPayouts(count: number) {
    pendingPayouts.set(count);
  }

  // Request metrics
  startRequestTimer(method: string, route: string) {
    return requestDuration.startTimer({ method, route });
  }

  observeRequest(method: string, route: string, statusCode: number, duration: number) {
    requestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  // Get metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error('Failed to generate metrics', { error: (error as Error).message });
      throw error;
    }
  }

  // Reset metrics (useful for testing)
  resetMetrics(): void {
    register.resetMetrics();
    collectDefaultMetrics({ prefix: 'commission_service_' });
  }

  // Get registry for advanced operations
  getRegistry() {
    return register;
  }

  // Health check for metrics
  async healthCheck(): Promise<{ status: string; metrics?: any }> {
    try {
      const metrics = await this.getMetrics();
      return {
        status: 'healthy',
        metrics: {
          totalMetrics: register.getMetricsAsArray().length,
          defaultMetricsEnabled: true,
        }
      };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
export default metricsService;

// Helper functions for easy metric recording
export const recordCommissionCalculated = (type: string, level: number) =>
  metricsService.recordCommissionCalculated(type, level);

export const recordCommissionPaid = (method: string, status: 'success' | 'failed') =>
  metricsService.recordCommissionPaid(method, status);

export const recordCommissionAmount = (amount: number, type: string, currency?: string) =>
  metricsService.recordCommissionAmount(amount, type, currency);

export const recordPayoutProcessed = (method: string, status: 'success' | 'failed') =>
  metricsService.recordPayoutProcessed(method, status);

export const recordBonusAchieved = (type: string, period: string) =>
  metricsService.recordBonusAchieved(type, period);

export const recordPerformanceMetric = (name: string, value: number, labels?: Record<string, any>) =>
  metricsService.observeRequest(labels?.method || 'unknown', labels?.path || 'unknown', parseInt(labels?.statusCode || '200'), value / 1000);