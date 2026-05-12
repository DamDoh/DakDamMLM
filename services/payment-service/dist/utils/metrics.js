"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPaymentError = exports.recordRefundRequest = exports.recordCommissionPayout = exports.recordPayoutRequest = exports.recordPaymentTransaction = exports.metricsService = void 0;
const prom_client_1 = require("prom-client");
const logger_1 = require("./logger");
// Enable default metrics collection
(0, prom_client_1.collectDefaultMetrics)({ prefix: 'payment_service_' });
// Custom metrics
const paymentTransactionsTotal = new prom_client_1.Counter({
    name: 'payment_service_payment_transactions_total',
    help: 'Total number of payment transactions',
    labelNames: ['status', 'method', 'provider'],
});
const paymentProcessingDuration = new prom_client_1.Histogram({
    name: 'payment_service_payment_processing_duration_seconds',
    help: 'Duration of payment processing in seconds',
    labelNames: ['method', 'provider'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});
const walletBalanceTotal = new prom_client_1.Gauge({
    name: 'payment_service_wallet_balance_total',
    help: 'Total wallet balance across all users',
});
const payoutRequestsTotal = new prom_client_1.Counter({
    name: 'payment_service_payout_requests_total',
    help: 'Total number of payout requests',
    labelNames: ['status', 'method'],
});
const commissionPayoutsTotal = new prom_client_1.Counter({
    name: 'payment_service_commission_payouts_total',
    help: 'Total number of commission payouts processed',
    labelNames: ['status'],
});
const refundRequestsTotal = new prom_client_1.Counter({
    name: 'payment_service_refund_requests_total',
    help: 'Total number of refund requests',
    labelNames: ['status'],
});
const paymentErrorsTotal = new prom_client_1.Counter({
    name: 'payment_service_errors_total',
    help: 'Total number of payment errors',
    labelNames: ['type', 'provider'],
});
const activeWallets = new prom_client_1.Gauge({
    name: 'payment_service_active_wallets',
    help: 'Number of active wallets',
});
const pendingPayouts = new prom_client_1.Gauge({
    name: 'payment_service_pending_payouts',
    help: 'Number of pending payouts',
});
// Performance monitoring
const requestDuration = new prom_client_1.Summary({
    name: 'payment_service_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
});
const databaseQueryDuration = new prom_client_1.Histogram({
    name: 'payment_service_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
class MetricsService {
    // Payment transaction metrics
    recordPaymentTransaction(status, method, provider) {
        paymentTransactionsTotal.inc({ status, method, provider });
    }
    startPaymentProcessingTimer(method, provider) {
        return paymentProcessingDuration.startTimer({ method, provider });
    }
    // Wallet metrics
    setWalletBalanceTotal(amount) {
        walletBalanceTotal.set(amount);
    }
    setActiveWallets(count) {
        activeWallets.set(count);
    }
    // Payout metrics
    recordPayoutRequest(status, method) {
        payoutRequestsTotal.inc({ status, method });
    }
    recordCommissionPayout(status) {
        commissionPayoutsTotal.inc({ status });
    }
    setPendingPayouts(count) {
        pendingPayouts.set(count);
    }
    // Refund metrics
    recordRefundRequest(status) {
        refundRequestsTotal.inc({ status });
    }
    // Error metrics
    recordPaymentError(type, provider) {
        paymentErrorsTotal.inc({ type, provider });
    }
    // Request metrics
    startRequestTimer(method, route) {
        return requestDuration.startTimer({ method, route });
    }
    observeRequest(method, route, statusCode, duration) {
        requestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
    }
    // Database metrics
    startDatabaseQueryTimer(operation, table) {
        return databaseQueryDuration.startTimer({ operation, table });
    }
    // Get metrics for Prometheus scraping
    async getMetrics() {
        try {
            return await prom_client_1.register.metrics();
        }
        catch (error) {
            logger_1.logger.error('Failed to generate metrics', { error: error.message });
            throw error;
        }
    }
    // Reset metrics (useful for testing)
    resetMetrics() {
        prom_client_1.register.resetMetrics();
        (0, prom_client_1.collectDefaultMetrics)({ prefix: 'payment_service_' });
    }
    // Get registry for advanced operations
    getRegistry() {
        return prom_client_1.register;
    }
    // Health check for metrics
    async healthCheck() {
        try {
            const metrics = await this.getMetrics();
            return {
                status: 'healthy',
                metrics: {
                    totalMetrics: prom_client_1.register.getMetricsAsArray().length,
                    defaultMetricsEnabled: true,
                }
            };
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
}
// Export singleton instance
exports.metricsService = new MetricsService();
exports.default = exports.metricsService;
// Helper functions for easy metric recording
const recordPaymentTransaction = (status, method, provider) => exports.metricsService.recordPaymentTransaction(status, method, provider);
exports.recordPaymentTransaction = recordPaymentTransaction;
const recordPayoutRequest = (status, method) => exports.metricsService.recordPayoutRequest(status, method);
exports.recordPayoutRequest = recordPayoutRequest;
const recordCommissionPayout = (status) => exports.metricsService.recordCommissionPayout(status);
exports.recordCommissionPayout = recordCommissionPayout;
const recordRefundRequest = (status) => exports.metricsService.recordRefundRequest(status);
exports.recordRefundRequest = recordRefundRequest;
const recordPaymentError = (type, provider) => exports.metricsService.recordPaymentError(type, provider);
exports.recordPaymentError = recordPaymentError;
//# sourceMappingURL=metrics.js.map