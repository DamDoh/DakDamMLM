// Health check API endpoint data
// Functions for API endpoints and external health check access

import { HealthCheckData } from './health-types';
import { systemHealthMonitor } from './health-monitor';

export async function getHealthCheckData(): Promise<HealthCheckData> {
  const report = await systemHealthMonitor.getCurrentHealth();

  return {
    status: report.overall,
    timestamp: report.timestamp,
    uptime: `${Math.floor(report.uptime / 3600)}h ${Math.floor((report.uptime % 3600) / 60)}m`,
    version: report.version,
    database: report.services.database.status,
    memory: `${report.performance.memoryUsage.toFixed(1)}MB`,
  };
}

// Export the monitor instance for direct access
export { systemHealthMonitor };