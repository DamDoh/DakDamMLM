// Advanced Monitoring Service
// Prometheus metrics and Grafana dashboard integration

import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import { logger } from '@/lib/logger';

// Enable default metrics collection
collectDefaultMetrics({ prefix: 'mlm_' });

export interface MetricLabels {
  method?: string;
  endpoint?: string;
  status_code?: string;
  user_id?: string;
  company_id?: string;
  feature_flag?: string;
  error_type?: string;
  [key: string]: string | undefined;
}

class AdvancedMonitoringService {
  private static instance: AdvancedMonitoringService;

  // HTTP Request Metrics
  private httpRequestDuration: Histogram<string>;
  private httpRequestsTotal: Counter<string>;
  private activeConnections: Gauge<string>;

  // Business Metrics
  private tenantCount: Gauge<string>;
  private featureFlagEvaluations: Counter<string>;
  private brandingOperations: Counter<string>;

  // Performance Metrics
  private cacheHitRatio: Gauge<string>;
  private databaseConnectionPool: Gauge<string>;
  private redisMemoryUsage: Gauge<string>;

  // Security Metrics
  private authenticationAttempts: Counter<string>;
  private rateLimitHits: Counter<string>;
  private blockedRequests: Counter<string>;

  // Error Metrics
  private applicationErrors: Counter<string>;
  private databaseErrors: Counter<string>;
  private externalServiceErrors: Counter<string>;

  private constructor() {
    this.initializeMetrics();
  }

  static getInstance(): AdvancedMonitoringService {
    if (!AdvancedMonitoringService.instance) {
      AdvancedMonitoringService.instance = new AdvancedMonitoringService();
    }
    return AdvancedMonitoringService.instance;
  }

  // Initialize all Prometheus metrics
  private initializeMetrics(): void {
    // HTTP Metrics
    this.httpRequestDuration = new Histogram({
      name: 'mlm_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'endpoint', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.httpRequestsTotal = new Counter({
      name: 'mlm_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'endpoint', 'status_code'],
    });

    this.activeConnections = new Gauge({
      name: 'mlm_active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
    });

    // Business Metrics
    this.tenantCount = new Gauge({
      name: 'mlm_tenant_count',
      help: 'Total number of active tenants',
    });

    this.featureFlagEvaluations = new Counter({
      name: 'mlm_feature_flag_evaluations_total',
      help: 'Total feature flag evaluations',
      labelNames: ['flag_key', 'result'],
    });

    this.brandingOperations = new Counter({
      name: 'mlm_branding_operations_total',
      help: 'Total branding operations',
      labelNames: ['operation', 'company_id'],
    });

    // Performance Metrics
    this.cacheHitRatio = new Gauge({
      name: 'mlm_cache_hit_ratio',
      help: 'Cache hit ratio (0-1)',
      labelNames: ['cache_type'],
    });

    this.databaseConnectionPool = new Gauge({
      name: 'mlm_database_connection_pool_size',
      help: 'Database connection pool size',
      labelNames: ['state'],
    });

    this.redisMemoryUsage = new Gauge({
      name: 'mlm_redis_memory_usage_bytes',
      help: 'Redis memory usage in bytes',
    });

    // Security Metrics
    this.authenticationAttempts = new Counter({
      name: 'mlm_authentication_attempts_total',
      help: 'Total authentication attempts',
      labelNames: ['result', 'method'],
    });

    this.rateLimitHits = new Counter({
      name: 'mlm_rate_limit_hits_total',
      help: 'Total rate limit hits',
      labelNames: ['endpoint', 'user_id'],
    });

    this.blockedRequests = new Counter({
      name: 'mlm_blocked_requests_total',
      help: 'Total blocked requests',
      labelNames: ['reason', 'ip_address'],
    });

    // Error Metrics
    this.applicationErrors = new Counter({
      name: 'mlm_application_errors_total',
      help: 'Total application errors',
      labelNames: ['type', 'endpoint'],
    });

    this.databaseErrors = new Counter({
      name: 'mlm_database_errors_total',
      help: 'Total database errors',
      labelNames: ['operation', 'table'],
    });

    this.externalServiceErrors = new Counter({
      name: 'mlm_external_service_errors_total',
      help: 'Total external service errors',
      labelNames: ['service', 'operation'],
    });

    logger.info('Advanced monitoring service initialized with Prometheus metrics');
  }

  // HTTP Request Metrics
  recordHttpRequest(method: string, endpoint: string, statusCode: number, duration: number): void {
    this.httpRequestDuration
      .labels(method, endpoint, statusCode.toString())
      .observe(duration);

    this.httpRequestsTotal
      .labels(method, endpoint, statusCode.toString())
      .inc();
  }

  // Business Metrics
  setTenantCount(count: number): void {
    this.tenantCount.set(count);
  }

  recordFeatureFlagEvaluation(flagKey: string, result: boolean): void {
    this.featureFlagEvaluations
      .labels(flagKey, result.toString())
      .inc();
  }

  recordBrandingOperation(operation: string, companyId: string): void {
    this.brandingOperations
      .labels(operation, companyId)
      .inc();
  }

  // Performance Metrics
  setCacheHitRatio(cacheType: string, ratio: number): void {
    this.cacheHitRatio
      .labels(cacheType)
      .set(ratio);
  }

  setDatabaseConnectionPoolSize(state: string, size: number): void {
    this.databaseConnectionPool
      .labels(state)
      .set(size);
  }

  setRedisMemoryUsage(bytes: number): void {
    this.redisMemoryUsage.set(bytes);
  }

  // Security Metrics
  recordAuthenticationAttempt(result: 'success' | 'failure', method: string): void {
    this.authenticationAttempts
      .labels(result, method)
      .inc();
  }

  recordRateLimitHit(endpoint: string, userId?: string): void {
    this.rateLimitHits
      .labels(endpoint, userId || 'anonymous')
      .inc();
  }

  recordBlockedRequest(reason: string, ipAddress: string): void {
    this.blockedRequests
      .labels(reason, ipAddress)
      .inc();
  }

  // Error Metrics
  recordApplicationError(type: string, endpoint?: string): void {
    this.applicationErrors
      .labels(type, endpoint || 'unknown')
      .inc();
  }

  recordDatabaseError(operation: string, table?: string): void {
    this.databaseErrors
      .labels(operation, table || 'unknown')
      .inc();
  }

  recordExternalServiceError(service: string, operation: string): void {
    this.externalServiceErrors
      .labels(service, operation)
      .inc();
  }

  // Get metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Get metrics registry
  getRegistry(): typeof register {
    return register;
  }

  // Create custom metric
  createGauge(name: string, help: string, labelNames?: string[]): Gauge<string> {
    return new Gauge({
      name: `mlm_${name}`,
      help,
      labelNames,
    });
  }

  createCounter(name: string, help: string, labelNames?: string[]): Counter<string> {
    return new Counter({
      name: `mlm_${name}`,
      help,
      labelNames,
    });
  }

  createHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]): Histogram<string> {
    return new Histogram({
      name: `mlm_${name}`,
      help,
      labelNames,
      buckets,
    });
  }

  createSummary(name: string, help: string, labelNames?: string[]): Summary<string> {
    return new Summary({
      name: `mlm_${name}`,
      help,
      labelNames,
    });
  }

  // Health check integration
  async getHealthStatus(): Promise<{
    status: string;
    metrics: {
      totalSeries: number;
      lastScrape: Date;
    };
  }> {
    const metrics = await register.getMetricsAsJSON();
    const totalSeries = metrics.length;

    return {
      status: 'healthy',
      metrics: {
        totalSeries,
        lastScrape: new Date(),
      },
    };
  }

  // Alert thresholds (for monitoring systems)
  getAlertThresholds(): Record<string, {
    warning: number;
    critical: number;
    description: string;
  }> {
    return {
      http_request_duration: {
        warning: 2, // seconds
        critical: 5, // seconds
        description: 'HTTP request duration threshold',
      },
      error_rate: {
        warning: 0.05, // 5%
        critical: 0.10, // 10%
        description: 'Application error rate threshold',
      },
      cache_hit_ratio: {
        warning: 0.8, // 80%
        critical: 0.6, // 60%
        description: 'Cache hit ratio threshold',
      },
    };
  }

  // Performance profiling
  startProfiling(operation: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;

      // Record performance metric
      this.createHistogram(
        `${operation}_duration`,
        `Duration of ${operation} operation`,
        ['result']
      ).observe(duration / 1000); // Convert to seconds
    };
  }
}

export const advancedMonitoringService = AdvancedMonitoringService.getInstance();
export default advancedMonitoringService;