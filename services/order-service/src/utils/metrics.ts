import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import { logger } from './logger';

// Enable default metrics collection
collectDefaultMetrics({ prefix: 'order_service_' });

// Custom metrics
const orderCreationsTotal = new Counter({
  name: 'order_service_order_creations_total',
  help: 'Total number of orders created',
  labelNames: ['status', 'payment_method'],
});

const orderStatusChangesTotal = new Counter({
  name: 'order_service_order_status_changes_total',
  help: 'Total number of order status changes',
  labelNames: ['old_status', 'new_status'],
});

const orderProcessingDuration = new Histogram({
  name: 'order_service_order_processing_duration_seconds',
  help: 'Duration of order processing in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const productQueriesTotal = new Counter({
  name: 'order_service_product_queries_total',
  help: 'Total number of product queries',
  labelNames: ['category'],
});

const inventoryUpdatesTotal = new Counter({
  name: 'order_service_inventory_updates_total',
  help: 'Total number of inventory updates',
  labelNames: ['change_type', 'reason'],
});

const cartOperationsTotal = new Counter({
  name: 'order_service_cart_operations_total',
  help: 'Total number of cart operations',
  labelNames: ['operation'],
});

const orderRevenueTotal = new Counter({
  name: 'order_service_order_revenue_total',
  help: 'Total order revenue processed',
  labelNames: ['currency', 'status'],
});

const activeOrders = new Gauge({
  name: 'order_service_active_orders',
  help: 'Number of active orders',
  labelNames: ['status'],
});

const lowStockProducts = new Gauge({
  name: 'order_service_low_stock_products',
  help: 'Number of products with low stock',
});

const orderErrorsTotal = new Counter({
  name: 'order_service_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint'],
});

const commissionTriggersTotal = new Counter({
  name: 'order_service_commission_triggers_total',
  help: 'Total number of commission calculation triggers',
  labelNames: ['trigger_type'],
});

// Performance monitoring
const requestDuration = new Summary({
  name: 'order_service_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

const databaseQueryDuration = new Histogram({
  name: 'order_service_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

class MetricsService {
  // Order creation metrics
  recordOrderCreation(status: 'success' | 'failed', paymentMethod?: string) {
    orderCreationsTotal.inc({ status, payment_method: paymentMethod || 'unknown' });
  }

  recordOrderStatusChange(oldStatus: string, newStatus: string) {
    orderStatusChangesTotal.inc({ old_status: oldStatus, new_status: newStatus });
  }

  startOrderProcessingTimer(operation: string) {
    return orderProcessingDuration.startTimer({ operation });
  }

  // Product metrics
  recordProductQuery(category?: string) {
    productQueriesTotal.inc({ category: category || 'unknown' });
  }

  // Inventory metrics
  recordInventoryUpdate(changeType: string, reason: string) {
    inventoryUpdatesTotal.inc({ change_type: changeType, reason });
  }

  // Cart metrics
  recordCartOperation(operation: string) {
    cartOperationsTotal.inc({ operation });
  }

  // Revenue metrics
  recordOrderRevenue(amount: number, currency: string = 'USD', status: string = 'completed') {
    orderRevenueTotal.inc({ currency, status }, amount);
  }

  // Active orders metrics
  setActiveOrders(count: number, status: string) {
    activeOrders.set({ status }, count);
  }

  // Low stock metrics
  setLowStockProducts(count: number) {
    lowStockProducts.set(count);
  }

  // Error metrics
  recordError(type: string, endpoint: string) {
    orderErrorsTotal.inc({ type, endpoint });
  }

  // Commission trigger metrics
  recordCommissionTrigger(triggerType: string) {
    commissionTriggersTotal.inc({ trigger_type: triggerType });
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
    collectDefaultMetrics({ prefix: 'order_service_' });
  }

  // Get registry for advanced operations
  getRegistry() {
    return register;
  }

  // Health check for metrics
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const start = Date.now();
      await this.getMetrics();
      const latency = Date.now() - start;
      return {
        status: 'healthy' as const,
        latency,
      };
    } catch (error) {
      return { status: 'unhealthy' as const };
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
export default metricsService;

// Helper functions for easy metric recording
export const recordOrderCreation = (status: 'success' | 'failed', paymentMethod?: string) =>
  metricsService.recordOrderCreation(status, paymentMethod);

export const recordOrderStatusChange = (oldStatus: string, newStatus: string) =>
  metricsService.recordOrderStatusChange(oldStatus, newStatus);

export const recordProductQuery = (category?: string) =>
  metricsService.recordProductQuery(category);

export const recordInventoryUpdate = (changeType: string, reason: string) =>
  metricsService.recordInventoryUpdate(changeType, reason);

export const recordCartOperation = (operation: string) =>
  metricsService.recordCartOperation(operation);

export const recordOrderRevenue = (amount: number, currency?: string, status?: string) =>
  metricsService.recordOrderRevenue(amount, currency, status);

export const recordError = (type: string, endpoint: string) =>
  metricsService.recordError(type, endpoint);

export const recordCommissionTrigger = (triggerType: string) =>
  metricsService.recordCommissionTrigger(triggerType);