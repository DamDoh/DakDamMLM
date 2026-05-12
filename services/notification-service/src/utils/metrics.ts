import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import { logger } from './logger';

// Enable default metrics collection
collectDefaultMetrics({ prefix: 'notification_service_' });

// Custom metrics
const notificationsSentTotal = new Counter({
  name: 'notification_service_notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['type', 'channel', 'status'],
});

const notificationProcessingDuration = new Histogram({
  name: 'notification_service_notification_processing_duration_seconds',
  help: 'Duration of notification processing in seconds',
  labelNames: ['channel', 'type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const notificationsQueued = new Gauge({
  name: 'notification_service_notifications_queued',
  help: 'Number of notifications currently queued',
});

const notificationsFailedTotal = new Counter({
  name: 'notification_service_notifications_failed_total',
  help: 'Total number of notifications that failed to send',
  labelNames: ['channel', 'reason'],
});

const templatesActive = new Gauge({
  name: 'notification_service_templates_active',
  help: 'Number of active notification templates',
});

const campaignsActive = new Gauge({
  name: 'notification_service_campaigns_active',
  help: 'Number of active notification campaigns',
});

const userPreferencesTotal = new Gauge({
  name: 'notification_service_user_preferences_total',
  help: 'Total number of user notification preferences configured',
});

// Performance monitoring
const requestDuration = new Summary({
  name: 'notification_service_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

const templateRenderingDuration = new Histogram({
  name: 'notification_service_template_rendering_duration_seconds',
  help: 'Template rendering duration in seconds',
  labelNames: ['template_id'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

const providerAPICallsTotal = new Counter({
  name: 'notification_service_provider_api_calls_total',
  help: 'Total number of API calls to notification providers',
  labelNames: ['provider', 'method', 'status'],
});

class MetricsService {
  // Notification metrics
  recordNotificationSent(type: string, channel: string, status: 'success' | 'failed') {
    notificationsSentTotal.inc({ type, channel, status });
  }

  startNotificationProcessingTimer(channel: string, type: string) {
    return notificationProcessingDuration.startTimer({ channel, type });
  }

  setNotificationsQueued(count: number) {
    notificationsQueued.set(count);
  }

  recordNotificationFailed(channel: string, reason: string) {
    notificationsFailedTotal.inc({ channel, reason });
  }

  setTemplatesActive(count: number) {
    templatesActive.set(count);
  }

  setCampaignsActive(count: number) {
    campaignsActive.set(count);
  }

  setUserPreferencesTotal(count: number) {
    userPreferencesTotal.set(count);
  }

  // Request metrics
  startRequestTimer(method: string, route: string) {
    return requestDuration.startTimer({ method, route });
  }

  observeRequest(method: string, route: string, statusCode: number, duration: number) {
    requestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  // Template metrics
  startTemplateRenderingTimer(templateId: string) {
    return templateRenderingDuration.startTimer({ template_id: templateId });
  }

  // Provider metrics
  recordProviderAPICall(provider: string, method: string, status: 'success' | 'failed') {
    providerAPICallsTotal.inc({ provider, method, status });
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
    collectDefaultMetrics({ prefix: 'notification_service_' });
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
export const recordNotificationSent = (type: string, channel: string, status: 'success' | 'failed') =>
  metricsService.recordNotificationSent(type, channel, status);

export const recordNotificationFailed = (channel: string, reason: string) =>
  metricsService.recordNotificationFailed(channel, reason);

export const recordProviderAPICall = (provider: string, method: string, status: 'success' | 'failed') =>
  metricsService.recordProviderAPICall(provider, method, status);