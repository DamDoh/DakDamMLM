"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordProviderAPICall = exports.recordNotificationFailed = exports.recordNotificationSent = exports.metricsService = void 0;
const prom_client_1 = require("prom-client");
const logger_1 = require("./logger");
// Enable default metrics collection
(0, prom_client_1.collectDefaultMetrics)({ prefix: 'notification_service_' });
// Custom metrics
const notificationsSentTotal = new prom_client_1.Counter({
    name: 'notification_service_notifications_sent_total',
    help: 'Total number of notifications sent',
    labelNames: ['type', 'channel', 'status'],
});
const notificationProcessingDuration = new prom_client_1.Histogram({
    name: 'notification_service_notification_processing_duration_seconds',
    help: 'Duration of notification processing in seconds',
    labelNames: ['channel', 'type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});
const notificationsQueued = new prom_client_1.Gauge({
    name: 'notification_service_notifications_queued',
    help: 'Number of notifications currently queued',
});
const notificationsFailedTotal = new prom_client_1.Counter({
    name: 'notification_service_notifications_failed_total',
    help: 'Total number of notifications that failed to send',
    labelNames: ['channel', 'reason'],
});
const templatesActive = new prom_client_1.Gauge({
    name: 'notification_service_templates_active',
    help: 'Number of active notification templates',
});
const campaignsActive = new prom_client_1.Gauge({
    name: 'notification_service_campaigns_active',
    help: 'Number of active notification campaigns',
});
const userPreferencesTotal = new prom_client_1.Gauge({
    name: 'notification_service_user_preferences_total',
    help: 'Total number of user notification preferences configured',
});
// Performance monitoring
const requestDuration = new prom_client_1.Summary({
    name: 'notification_service_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
});
const templateRenderingDuration = new prom_client_1.Histogram({
    name: 'notification_service_template_rendering_duration_seconds',
    help: 'Template rendering duration in seconds',
    labelNames: ['template_id'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
});
const providerAPICallsTotal = new prom_client_1.Counter({
    name: 'notification_service_provider_api_calls_total',
    help: 'Total number of API calls to notification providers',
    labelNames: ['provider', 'method', 'status'],
});
class MetricsService {
    // Notification metrics
    recordNotificationSent(type, channel, status) {
        notificationsSentTotal.inc({ type, channel, status });
    }
    startNotificationProcessingTimer(channel, type) {
        return notificationProcessingDuration.startTimer({ channel, type });
    }
    setNotificationsQueued(count) {
        notificationsQueued.set(count);
    }
    recordNotificationFailed(channel, reason) {
        notificationsFailedTotal.inc({ channel, reason });
    }
    setTemplatesActive(count) {
        templatesActive.set(count);
    }
    setCampaignsActive(count) {
        campaignsActive.set(count);
    }
    setUserPreferencesTotal(count) {
        userPreferencesTotal.set(count);
    }
    // Request metrics
    startRequestTimer(method, route) {
        return requestDuration.startTimer({ method, route });
    }
    observeRequest(method, route, statusCode, duration) {
        requestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
    }
    // Template metrics
    startTemplateRenderingTimer(templateId) {
        return templateRenderingDuration.startTimer({ template_id: templateId });
    }
    // Provider metrics
    recordProviderAPICall(provider, method, status) {
        providerAPICallsTotal.inc({ provider, method, status });
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
        (0, prom_client_1.collectDefaultMetrics)({ prefix: 'notification_service_' });
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
const recordNotificationSent = (type, channel, status) => exports.metricsService.recordNotificationSent(type, channel, status);
exports.recordNotificationSent = recordNotificationSent;
const recordNotificationFailed = (channel, reason) => exports.metricsService.recordNotificationFailed(channel, reason);
exports.recordNotificationFailed = recordNotificationFailed;
const recordProviderAPICall = (provider, method, status) => exports.metricsService.recordProviderAPICall(provider, method, status);
exports.recordProviderAPICall = recordProviderAPICall;
//# sourceMappingURL=metrics.js.map