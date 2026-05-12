// Database Optimization Service
// Connection pooling, query optimization, and performance monitoring

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections: number;
  minConnections: number;
  connectionTimeoutMillis: number;
  queryTimeout: number;
  ssl: boolean;
  poolSize: number;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  rowCount?: number;
  parameters?: any[];
}

export interface DatabaseStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingClients: number;
  slowQueries: QueryMetrics[];
  cacheHitRatio: number;
  indexUsage: Record<string, number>;
}

class DatabaseOptimizationService {
  private static instance: DatabaseOptimizationService;
  private prisma: PrismaClient;
  private config: DatabaseConfig;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThreshold = 1000; // ms

  private constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'mlm_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      ssl: process.env.DB_SSL === 'true',
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    };

    this.initializePrisma();
    this.setupMonitoring();
  }

  static getInstance(): DatabaseOptimizationService {
    if (!DatabaseOptimizationService.instance) {
      DatabaseOptimizationService.instance = new DatabaseOptimizationService();
    }
    return DatabaseOptimizationService.instance;
  }

  // Initialize Prisma with optimized settings
  private initializePrisma(): void {
    this.prisma = new PrismaClient({
      datasourceUrl: this.buildConnectionString(),
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    // Add middleware for query monitoring
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        // Record query metrics
        this.recordQueryMetrics({
          query: params.model ? `${params.action} on ${params.model}` : params.action,
          duration,
          timestamp: new Date(),
          success: true,
          rowCount: Array.isArray(result) ? result.length : undefined,
          parameters: params.args,
        });

        // Log slow queries
        if (duration > this.slowQueryThreshold) {
          logger.warn('Slow database query detected', {
            query: params.model ? `${params.action} on ${params.model}` : params.action,
            duration,
            model: params.model,
            action: params.action,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        this.recordQueryMetrics({
          query: params.model ? `${params.action} on ${params.model}` : params.action,
          duration,
          timestamp: new Date(),
          success: false,
          parameters: params.args,
        });

        throw error;
      }
    });
  }

  // Build optimized connection string
  private buildConnectionString(): string {
    const params = new URLSearchParams({
      'connection_limit': this.config.poolSize.toString(),
      'pool_timeout': '20',
      'connection_timeout': (this.config.connectionTimeoutMillis / 1000).toString(),
      'statement_timeout': this.config.queryTimeout.toString(),
      'idle_in_transaction_session_timeout': '300000', // 5 minutes
      'tcp_keepalives_idle': '60',
      'tcp_keepalives_interval': '10',
      'tcp_keepalives_count': '3',
    });

    let connectionString = `postgresql://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}?${params}`;

    if (this.config.ssl) {
      connectionString += '&sslmode=require';
    }

    return connectionString;
  }

  // Setup database monitoring
  private setupMonitoring(): void {
    // Monitor Prisma events
    this.prisma.$on('query', (event) => {
      logger.debug('Database query executed', {
        query: event.query,
        duration: event.duration,
        timestamp: event.timestamp,
      });
    });

    this.prisma.$on('info', (event) => {
      logger.info('Database info', { message: event.message, timestamp: event.timestamp });
    });

    this.prisma.$on('warn', (event) => {
      logger.warn('Database warning', { message: event.message, timestamp: event.timestamp });
    });

    this.prisma.$on('error', (event) => {
      logger.error('Database error', { message: event.message, timestamp: event.timestamp });
    });
  }

  // Get optimized Prisma client
  getPrisma(): PrismaClient {
    return this.prisma;
  }

  // Execute raw query with monitoring
  async executeRawQuery<T = any>(
    query: string,
    parameters: any[] = []
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await this.prisma.$queryRaw<T>(query, ...parameters);
      const duration = Date.now() - startTime;

      this.recordQueryMetrics({
        query,
        duration,
        timestamp: new Date(),
        success: true,
        parameters,
      });

      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow raw query detected', { query, duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordQueryMetrics({
        query,
        duration,
        timestamp: new Date(),
        success: false,
        parameters,
      });

      throw error;
    }
  }

  // Execute transaction with optimization
  async executeTransaction<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return fn(tx);
    });
  }

  // Get database statistics
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      // Get connection stats (simplified - would need actual pool monitoring)
      const connectionStats = await this.executeRawQuery(`
        SELECT
          count(*) as active_connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `);

      // Get slow queries from our metrics
      const recentSlowQueries = this.queryMetrics
        .filter(metric => !metric.success && metric.duration > this.slowQueryThreshold)
        .slice(-10); // Last 10 slow queries

      // Get index usage (simplified)
      const indexUsage = await this.executeRawQuery(`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 10
      `);

      const indexUsageMap: Record<string, number> = {};
      (indexUsage as any[]).forEach((index: any) => {
        indexUsageMap[index.indexname] = index.idx_scan;
      });

      return {
        activeConnections: parseInt(connectionStats[0]?.active_connections || '0'),
        idleConnections: 0, // Would need pool monitoring
        totalConnections: this.config.poolSize,
        waitingClients: 0, // Would need pool monitoring
        slowQueries: recentSlowQueries,
        cacheHitRatio: 0, // Would need PostgreSQL cache monitoring
        indexUsage: indexUsageMap,
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        waitingClients: 0,
        slowQueries: [],
        cacheHitRatio: 0,
        indexUsage: {},
      };
    }
  }

  // Optimize query performance
  async analyzeQueryPerformance(query: string, parameters: any[] = []): Promise<{
    executionPlan: any;
    estimatedCost: number;
    actualTime: number;
    recommendations: string[];
  }> {
    try {
      // Get execution plan
      const planResult = await this.executeRawQuery(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        ${query}
      `, parameters);

      const plan = planResult[0]?.['EXPLAIN'];
      const executionTime = plan?.[0]?.['Execution Time'] || 0;

      // Analyze plan and provide recommendations
      const recommendations = this.analyzeExecutionPlan(plan);

      return {
        executionPlan: plan,
        estimatedCost: plan?.[0]?.['Total Cost'] || 0,
        actualTime: executionTime,
        recommendations,
      };
    } catch (error) {
      logger.error('Query analysis failed:', error);
      return {
        executionPlan: null,
        estimatedCost: 0,
        actualTime: 0,
        recommendations: ['Query analysis failed'],
      };
    }
  }

  // Create database indexes for optimization
  async createPerformanceIndexes(): Promise<void> {
    try {
      logger.info('Creating performance indexes...');

      // Index for user searches
      await this.executeRawQuery(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active
        ON users(email, active) WHERE active = true;
      `);

      // Index for company queries
      await this.executeRawQuery(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_active_verified
        ON companies(is_active, is_verified) WHERE is_active = true;
      `);

      // Index for order queries
      await this.executeRawQuery(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_date_status
        ON orders(user_id, date, status);
      `);

      // Index for commission queries
      await this.executeRawQuery(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commissions_user_date_type
        ON commissions(user_id, date, type);
      `);

      logger.info('Performance indexes created successfully');
    } catch (error) {
      logger.error('Failed to create performance indexes:', error);
    }
  }

  // Vacuum and analyze tables for optimization
  async optimizeTables(): Promise<void> {
    try {
      logger.info('Starting database optimization...');

      // Vacuum analyze main tables
      const tables = ['users', 'companies', 'orders', 'commissions', 'products'];

      for (const table of tables) {
        await this.executeRawQuery(`VACUUM ANALYZE ${table}`);
      }

      logger.info('Database optimization completed');
    } catch (error) {
      logger.error('Database optimization failed:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    connection: boolean;
    queryTime: number;
    activeConnections: number;
  }> {
    try {
      const startTime = Date.now();

      // Simple health check query
      await this.executeRawQuery('SELECT 1 as health_check');

      const queryTime = Date.now() - startTime;
      const stats = await this.getDatabaseStats();

      const isHealthy = queryTime < 1000 && stats.activeConnections < this.config.maxConnections;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        connection: true,
        queryTime,
        activeConnections: stats.activeConnections,
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        connection: false,
        queryTime: 0,
        activeConnections: 0,
      };
    }
  }

  // Private helper methods

  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
  }

  private analyzeExecutionPlan(plan: any): string[] {
    const recommendations: string[] = [];

    if (!plan || !Array.isArray(plan)) return recommendations;

    // Analyze for common issues
    plan.forEach((node: any) => {
      if (node['Node Type'] === 'Seq Scan' && node['Relation Name']) {
        recommendations.push(`Consider adding an index on table '${node['Relation Name']}'`);
      }

      if (node['Total Cost'] > 10000) {
        recommendations.push('Query cost is high - consider optimization');
      }

      if (node['Rows Removed by Filter'] > node['Rows']) {
        recommendations.push('Many rows are being filtered - index may help');
      }
    });

    return recommendations;
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info('Database optimization service shut down');
  }
}

export const databaseOptimizationService = DatabaseOptimizationService.getInstance();
export default databaseOptimizationService;