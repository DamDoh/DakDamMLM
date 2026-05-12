import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import { logger } from './logger';

// Enable default metrics collection
collectDefaultMetrics({ prefix: 'payment_service_' });

// Custom metrics
const paymentTransactionsTotal = new Counter({
  name: 'payment_service_payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['status', 'method', 'provider'],
});

const paymentProcessingDuration = new Histogram({
  name: 'payment_service_payment_processing_duration_seconds',
  help: 'Duration of payment processing in seconds',
  labelNames: ['method', 'provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const walletBalanceTotal = new Gauge({
  name: 'payment_service_wallet_balance_total',
  help: 'Total wallet balance across all users',
});

const payoutRequestsTotal = new Counter({
  name: 'payment_service_payout_requests_total',
  help: 'Total number of payout requests',
  labelNames: ['status', 'method'],
});

const commissionPayoutsTotal = new Counter({
  name: 'payment_service_commission_payouts_total',
  help: 'Total number of commission payouts processed',
  labelNames: ['status'],
});

const refundRequestsTotal = new Counter({
  name: 'payment_service_refund_requests_total',
  help: 'Total number of refund requests',
  labelNames: ['status'],
});

const paymentErrorsTotal = new Counter({
  name: 'payment_service_errors_total',
  help: 'Total number of payment errors',
  labelNames: ['type', 'provider'],
});

const activeWallets = new Gauge({
  name: 'payment_service_active_wallets',
  help: 'Number of active wallets',
});

const pendingPayouts = new Gauge({
  name: 'payment_service_pending_payouts',
  help: 'Number of pending payouts',
});

// Performance monitoring
const requestDuration = new Summary({
  name: 'payment_service_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

const databaseQueryDuration = new Histogram({
  name: 'payment_service_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

class MetricsService {
  // Payment transaction metrics
  recordPaymentTransaction(status: 'success' | 'failed', method: string, provider: string) {
    paymentTransactionsTotal.inc({ status, method, provider });
  }

  startPaymentProcessingTimer(method: string, provider: string) {
    return paymentProcessingDuration.startTimer({ method, provider });
  }

  // Wallet metrics
  setWalletBalanceTotal(amount: number) {
    walletBalanceTotal.set(amount);
  }

  setActiveWallets(count: number) {
    activeWallets.set(count);
  }

  // Payout metrics
  recordPayoutRequest(status: string, method: string) {
    payoutRequestsTotal.inc({ status, method });
  }

  recordCommissionPayout(status: 'success' | 'failed') {
    commissionPayoutsTotal.inc({ status });
  }

  setPendingPayouts(count: number) {
    pendingPayouts.set(count);
  }

  // Refund metrics
  recordRefundRequest(status: string) {
    refundRequestsTotal.inc({ status });
  }

  // Error metrics
  recordPaymentError(type: string, provider: string) {
    paymentErrorsTotal.inc({ type, provider });
  }

  // Request metrics
  startRequestTimer(method: string, route: string) {
    return requestDuration.startTimer({ method, route });
  }

  observeRequest(method: string, route: string, statusCode: number, duration: number) {
    requestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  // Database metrics
  startDatabaseQueryTimer(operation: string, table: string) {
    return databaseQueryDuration.startTimer({ operation, table });
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
    collectDefaultMetrics({ prefix: 'payment_service_' });
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
export const recordPaymentTransaction = (status: 'success' | 'failed', method: string, provider: string) =>
  metricsService.recordPaymentTransaction(status, method, provider);

export const recordPayoutRequest = (status: string, method: string) =>
  metricsService.recordPayoutRequest(status, method);

export const recordCommissionPayout = (status: 'success' | 'failed') =>
  metricsService.recordCommissionPayout(status);

export const recordRefundRequest = (status: string) =>
  metricsService.recordRefundRequest(status);

export const recordPaymentError = (type: string, provider: string) =>
  metricsService.recordPaymentError(type, provider);