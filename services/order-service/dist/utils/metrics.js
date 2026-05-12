"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordCommissionTrigger = exports.recordError = exports.recordOrderRevenue = exports.recordCartOperation = exports.recordInventoryUpdate = exports.recordProductQuery = exports.recordOrderStatusChange = exports.recordOrderCreation = exports.metricsService = void 0;
const prom_client_1 = require("prom-client");
const logger_1 = require("./logger");
// Enable default metrics collection
(0, prom_client_1.collectDefaultMetrics)({ prefix: 'order_service_' });
// Custom metrics
const orderCreationsTotal = new prom_client_1.Counter({
    name: 'order_service_order_creations_total',
    help: 'Total number of orders created',
    labelNames: ['status', 'payment_method'],
});
const orderStatusChangesTotal = new prom_client_1.Counter({
    name: 'order_service_order_status_changes_total',
    help: 'Total number of order status changes',
    labelNames: ['old_status', 'new_status'],
});
const orderProcessingDuration = new prom_client_1.Histogram({
    name: 'order_service_order_processing_duration_seconds',
    help: 'Duration of order processing in seconds',
    labelNames: ['operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});
const productQueriesTotal = new prom_client_1.Counter({
    name: 'order_service_product_queries_total',
    help: 'Total number of product queries',
    labelNames: ['category'],
});
const inventoryUpdatesTotal = new prom_client_1.Counter({
    name: 'order_service_inventory_updates_total',
    help: 'Total number of inventory updates',
    labelNames: ['change_type', 'reason'],
});
const cartOperationsTotal = new prom_client_1.Counter({
    name: 'order_service_cart_operations_total',
    help: 'Total number of cart operations',
    labelNames: ['operation'],
});
const orderRevenueTotal = new prom_client_1.Counter({
    name: 'order_service_order_revenue_total',
    help: 'Total order revenue processed',
    labelNames: ['currency', 'status'],
});
const activeOrders = new prom_client_1.Gauge({
    name: 'order_service_active_orders',
    help: 'Number of active orders',
    labelNames: ['status'],
});
const lowStockProducts = new prom_client_1.Gauge({
    name: 'order_service_low_stock_products',
    help: 'Number of products with low stock',
});
const orderErrorsTotal = new prom_client_1.Counter({
    name: 'order_service_errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'endpoint'],
});
const commissionTriggersTotal = new prom_client_1.Counter({
    name: 'order_service_commission_triggers_total',
    help: 'Total number of commission calculation triggers',
    labelNames: ['trigger_type'],
});
// Performance monitoring
const requestDuration = new prom_client_1.Summary({
    name: 'order_service_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
});
const databaseQueryDuration = new prom_client_1.Histogram({
    name: 'order_service_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
class MetricsService {
    // Order creation metrics
    recordOrderCreation(status, paymentMethod) {
        orderCreationsTotal.inc({ status, payment_method: paymentMethod || 'unknown' });
    }
    recordOrderStatusChange(oldStatus, newStatus) {
        orderStatusChangesTotal.inc({ old_status: oldStatus, new_status: newStatus });
    }
    startOrderProcessingTimer(operation) {
        return orderProcessingDuration.startTimer({ operation });
    }
    // Product metrics
    recordProductQuery(category) {
        productQueriesTotal.inc({ category: category || 'unknown' });
    }
    // Inventory metrics
    recordInventoryUpdate(changeType, reason) {
        inventoryUpdatesTotal.inc({ change_type: changeType, reason });
    }
    // Cart metrics
    recordCartOperation(operation) {
        cartOperationsTotal.inc({ operation });
    }
    // Revenue metrics
    recordOrderRevenue(amount, currency = 'USD', status = 'completed') {
        orderRevenueTotal.inc({ currency, status }, amount);
    }
    // Active orders metrics
    setActiveOrders(count, status) {
        activeOrders.set({ status }, count);
    }
    // Low stock metrics
    setLowStockProducts(count) {
        lowStockProducts.set(count);
    }
    // Error metrics
    recordError(type, endpoint) {
        orderErrorsTotal.inc({ type, endpoint });
    }
    // Commission trigger metrics
    recordCommissionTrigger(triggerType) {
        commissionTriggersTotal.inc({ trigger_type: triggerType });
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
        (0, prom_client_1.collectDefaultMetrics)({ prefix: 'order_service_' });
    }
    // Get registry for advanced operations
    getRegistry() {
        return prom_client_1.register;
    }
    // Health check for metrics
    async healthCheck() {
        try {
            const start = Date.now();
            await this.getMetrics();
            const latency = Date.now() - start;
            return {
                status: 'healthy',
                latency,
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
const recordOrderCreation = (status, paymentMethod) => exports.metricsService.recordOrderCreation(status, paymentMethod);
exports.recordOrderCreation = recordOrderCreation;
const recordOrderStatusChange = (oldStatus, newStatus) => exports.metricsService.recordOrderStatusChange(oldStatus, newStatus);
exports.recordOrderStatusChange = recordOrderStatusChange;
const recordProductQuery = (category) => exports.metricsService.recordProductQuery(category);
exports.recordProductQuery = recordProductQuery;
const recordInventoryUpdate = (changeType, reason) => exports.metricsService.recordInventoryUpdate(changeType, reason);
exports.recordInventoryUpdate = recordInventoryUpdate;
const recordCartOperation = (operation) => exports.metricsService.recordCartOperation(operation);
exports.recordCartOperation = recordCartOperation;
const recordOrderRevenue = (amount, currency, status) => exports.metricsService.recordOrderRevenue(amount, currency, status);
exports.recordOrderRevenue = recordOrderRevenue;
const recordError = (type, endpoint) => exports.metricsService.recordError(type, endpoint);
exports.recordError = recordError;
const recordCommissionTrigger = (triggerType) => exports.metricsService.recordCommissionTrigger(triggerType);
exports.recordCommissionTrigger = recordCommissionTrigger;
//# sourceMappingURL=metrics.js.map