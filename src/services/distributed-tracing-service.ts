// Distributed Tracing Service
// OpenTelemetry integration for distributed tracing

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { trace, Span, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { logger } from '@/lib/logger';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
}

class DistributedTracingService {
  private static instance: DistributedTracingService;
  private tracer: Tracer;
  private provider: NodeTracerProvider;

  private constructor() {
    this.initializeTracing();
    this.tracer = trace.getTracer('mlm-platform', '1.0.0');
  }

  static getInstance(): DistributedTracingService {
    if (!DistributedTracingService.instance) {
      DistributedTracingService.instance = new DistributedTracingService();
    }
    return DistributedTracingService.instance;
  }

  // Initialize OpenTelemetry tracing
  private initializeTracing(): void {
    // Create Jaeger exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      username: process.env.JAEGER_USERNAME,
      password: process.env.JAEGER_PASSWORD,
    });

    // Create trace provider
    this.provider = new NodeTracerProvider({
      resource: {
        service: {
          name: 'mlm-platform',
          version: '1.0.0',
        },
        attributes: {
          'service.instance.id': process.env.HOSTNAME || 'unknown',
          'service.environment': process.env.NODE_ENV || 'development',
        },
      },
    });

    // Add span processor
    this.provider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          requestHook: (span, request) => {
            span.setAttribute('http.method', request.method || 'GET');
            span.setAttribute('http.url', request.href || 'unknown');
          },
          responseHook: (span, response) => {
            span.setAttribute('http.status_code', response.statusCode || 0);
          },
        }),
        new PgInstrumentation({
          requestHook: (span, connection, query) => {
            span.setAttribute('db.statement', query.replace(/\s+/g, ' ').trim());
            span.setAttribute('db.connection_string', this.maskConnectionString(connection));
          },
        }),
        new IORedisInstrumentation({
          requestHook: (span, command, args) => {
            span.setAttribute('redis.command', command);
            span.setAttribute('redis.args_count', args.length);
          },
        }),
      ],
    });

    // Register the provider
    this.provider.register();

    logger.info('Distributed tracing initialized with OpenTelemetry');
  }

  // Create a new span
  startSpan(name: string, parentSpan?: Span): Span {
    const span = this.tracer.startSpan(name, {
      parent: parentSpan,
    });

    // Add common attributes
    span.setAttribute('service.name', 'mlm-platform');
    span.setAttribute('service.version', '1.0.0');

    return span;
  }

  // Wrap a function with tracing
  async traceFunction<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.startSpan(name);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Add event to current span
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Set attributes on current span
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  // Create child span
  startChildSpan(name: string, attributes?: Record<string, string | number | boolean>): Span | null {
    const parentSpan = trace.getActiveSpan();
    if (!parentSpan) return null;

    const childSpan = this.startSpan(name, parentSpan);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        childSpan.setAttribute(key, value);
      });
    }

    return childSpan;
  }

  // Get current trace context
  getCurrentTraceContext(): TraceContext | null {
    const span = trace.getActiveSpan();
    if (!span) return null;

    const spanContext = span.spanContext();

    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: spanContext.parentSpanId || undefined,
      serviceName: 'mlm-platform',
      operationName: span.name,
    };
  }

  // Inject trace context into headers (for outgoing requests)
  injectTraceContext(headers: Record<string, string>): void {
    const span = trace.getActiveSpan();
    if (span) {
      trace.inject(span.spanContext(), 'http', {
        setHeader: (key: string, value: string) => {
          headers[key] = value;
        },
      });
    }
  }

  // Extract trace context from headers (for incoming requests)
  extractTraceContext(headers: Record<string, string>): void {
    const spanContext = trace.extract('http', {
      getHeader: (key: string) => headers[key.toLowerCase()],
    });

    if (spanContext) {
      trace.setSpanContext(spanContext);
    }
  }

  // Database operation tracing
  async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return this.traceFunction(
      `db.${operation}`,
      async (span) => {
        span.setAttribute('db.operation', operation);
        span.setAttribute('db.table', table);
        span.setAttribute('db.system', 'postgresql');

        return fn(span);
      }
    );
  }

  // API endpoint tracing
  async traceAPIEndpoint<T>(
    method: string,
    path: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return this.traceFunction(
      `http.${method}`,
      async (span) => {
        span.setAttribute('http.method', method);
        span.setAttribute('http.route', path);
        span.setAttribute('http.scheme', 'https');

        return fn(span);
      }
    );
  }

  // Business logic tracing
  async traceBusinessOperation<T>(
    operation: string,
    entityType: string,
    entityId: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return this.traceFunction(
      `business.${operation}`,
      async (span) => {
        span.setAttribute('business.operation', operation);
        span.setAttribute('business.entity_type', entityType);
        span.setAttribute('business.entity_id', entityId);

        return fn(span);
      }
    );
  }

  // External service tracing
  async traceExternalService<T>(
    service: string,
    operation: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return this.traceFunction(
      `external.${service}.${operation}`,
      async (span) => {
        span.setAttribute('external.service', service);
        span.setAttribute('external.operation', operation);

        return fn(span);
      }
    );
  }

  // Error tracking in traces
  recordException(error: Error, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(`error.${key}`, value);
        });
      }
    }
  }

  // Performance monitoring
  startTimer(operation: string): () => void {
    const startTime = Date.now();
    const span = trace.getActiveSpan();

    return () => {
      const duration = Date.now() - startTime;
      if (span) {
        span.setAttribute(`performance.${operation}.duration_ms`, duration);
        span.addEvent(`performance.${operation}.completed`, {
          duration_ms: duration,
        });
      }
    };
  }

  // Get tracer instance
  getTracer(): Tracer {
    return this.tracer;
  }

  // Shutdown tracing
  async shutdown(): Promise<void> {
    await this.provider.shutdown();
    logger.info('Distributed tracing service shut down');
  }

  // Private helper methods
  private maskConnectionString(connection: any): string {
    // Mask sensitive information in connection string
    if (typeof connection === 'string') {
      return connection.replace(/password=[^&\s]+/gi, 'password=***');
    }
    return 'postgresql://***:***@***:***';
  }
}

export const distributedTracingService = DistributedTracingService.getInstance();
export default distributedTracingService;