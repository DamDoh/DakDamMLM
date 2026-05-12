"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordBonusAchieved = exports.recordPayoutProcessed = exports.recordCommissionAmount = exports.recordCommissionPaid = exports.recordCommissionCalculated = exports.metricsService = void 0;
const prom_client_1 = require("prom-client");
const logger_1 = require("./logger");
// Enable default metrics collection
(0, prom_client_1.collectDefaultMetrics)({ prefix: 'commission_service_' });
// Custom metrics
const commissionsCalculatedTotal = new prom_client_1.Counter({
    name: 'commission_service_commissions_calculated_total',
    help: 'Total number of commissions calculated',
    labelNames: ['type', 'level'],
});
const commissionCalculationDuration = new prom_client_1.Histogram({
    name: 'commission_service_commission_calculation_duration_seconds',
    help: 'Duration of commission calculation in seconds',
    labelNames: ['order_count', 'levels_calculated'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});
const commissionsPaidTotal = new prom_client_1.Counter({
    name: 'commission_service_commissions_paid_total',
    help: 'Total number of commissions paid',
    labelNames: ['method', 'status'],
});
const commissionAmountTotal = new prom_client_1.Counter({
    name: 'commission_service_commission_amount_total',
    help: 'Total commission amounts processed',
    labelNames: ['type', 'currency'],
});
const payoutsProcessedTotal = new prom_client_1.Counter({
    name: 'commission_service_payouts_processed_total',
    help: 'Total number of payouts processed',
    labelNames: ['method', 'status'],
});
const payoutProcessingDuration = new prom_client_1.Histogram({
    name: 'commission_service_payout_processing_duration_seconds',
    help: 'Duration of payout processing in seconds',
    labelNames: ['method'],
    buckets: [1, 5, 10, 30, 60, 300],
});
const bonusesAchievedTotal = new prom_client_1.Counter({
    name: 'commission_service_bonuses_achieved_total',
    help: 'Total number of bonuses achieved',
    labelNames: ['type', 'period'],
});
const activeCommissionRules = new prom_client_1.Gauge({
    name: 'commission_service_active_commission_rules',
    help: 'Number of active commission rules',
});
const pendingCommissions = new prom_client_1.Gauge({
    name: 'commission_service_pending_commissions',
    help: 'Number of pending commissions',
});
const pendingPayouts = new prom_client_1.Gauge({
    name: 'commission_service_pending_payouts',
    help: 'Number of pending payouts',
});
// Performance monitoring
const requestDuration = new prom_client_1.Summary({
    name: 'commission_service_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
});
class MetricsService {
    // Commission metrics
    recordCommissionCalculated(type, level) {
        commissionsCalculatedTotal.inc({ type, level: level.toString() });
    }
    startCommissionCalculationTimer(orderCount, levelsCalculated) {
        return commissionCalculationDuration.startTimer({ order_count: orderCount.toString(), levels_calculated: levelsCalculated.toString() });
    }
    recordCommissionPaid(method, status) {
        commissionsPaidTotal.inc({ method, status });
    }
    recordCommissionAmount(amount, type, currency = 'USD') {
        commissionAmountTotal.inc({ type, currency }, amount);
    }
    recordPayoutProcessed(method, status) {
        payoutsProcessedTotal.inc({ method, status });
    }
    startPayoutProcessingTimer(method) {
        return payoutProcessingDuration.startTimer({ method });
    }
    recordBonusAchieved(type, period) {
        bonusesAchievedTotal.inc({ type, period });
    }
    setActiveCommissionRules(count) {
        activeCommissionRules.set(count);
    }
    setPendingCommissions(count) {
        pendingCommissions.set(count);
    }
    setPendingPayouts(count) {
        pendingPayouts.set(count);
    }
    // Request metrics
    startRequestTimer(method, route) {
        return requestDuration.startTimer({ method, route });
    }
    observeRequest(method, route, statusCode, duration) {
        requestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
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
        (0, prom_client_1.collectDefaultMetrics)({ prefix: 'commission_service_' });
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
const recordCommissionCalculated = (type, level) => exports.metricsService.recordCommissionCalculated(type, level);
exports.recordCommissionCalculated = recordCommissionCalculated;
const recordCommissionPaid = (method, status) => exports.metricsService.recordCommissionPaid(method, status);
exports.recordCommissionPaid = recordCommissionPaid;
const recordCommissionAmount = (amount, type, currency) => exports.metricsService.recordCommissionAmount(amount, type, currency);
exports.recordCommissionAmount = recordCommissionAmount;
const recordPayoutProcessed = (method, status) => exports.metricsService.recordPayoutProcessed(method, status);
exports.recordPayoutProcessed = recordPayoutProcessed;
const recordBonusAchieved = (type, period) => exports.metricsService.recordBonusAchieved(type, period);
exports.recordBonusAchieved = recordBonusAchieved;
//# sourceMappingURL=metrics.js.map