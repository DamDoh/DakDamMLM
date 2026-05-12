// System Health Monitoring Types
// Comprehensive type definitions for health checks

export interface SystemHealthReport {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  services: {
    web: ServiceHealth;
    database: ServiceHealth;
    cache: ServiceHealth;
    messageQueue: ServiceHealth;
    analytics: ServiceHealth;
    genealogy: ServiceHealth;
    commission: ServiceHealth;
    notification: ServiceHealth;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: number;
  };
  business: {
    totalMembers: number;
    activeMembers: number;
    totalCommissions: number;
    lastCommissionCycle?: string;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: string;
  error?: string;
  details?: Record<string, any>;
}

export interface HealthCheckData {
  status: string;
  timestamp: string;
  uptime: string;
  version: string;
  database: string;
  memory: string;
}

export interface BusinessMetrics {
  totalMembers: number;
  activeMembers: number;
  totalCommissions: number;
  lastCommissionCycle?: string;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
}