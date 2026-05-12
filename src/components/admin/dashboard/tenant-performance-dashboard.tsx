'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Users,
  Database,
  Cpu,
  HardDrive
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface TenantMetrics {
  companyId: string;
  activeUsers: number;
  apiCallsThisHour: number;
  databaseConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  responseTimeAvg: number;
  errorRate: number;
  lastUpdated: string;
}

interface TenantQuota {
  companyId: string;
  maxConcurrentUsers: number;
  maxApiCallsPerHour: number;
  maxDatabaseConnections: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
  priority: 'low' | 'medium' | 'high';
}

interface TenantPerformance {
  metrics: TenantMetrics;
  quota: TenantQuota;
}

export function TenantPerformanceDashboard() {
  const [tenants, setTenants] = useState<TenantPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useI18n();

  const loadTenantPerformance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in again',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/tenant-performance', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load tenant performance data');
      }

      const result = await response.json();

      // Transform data for component
      const tenantData: TenantPerformance[] = [];
      for (const quota of result.performance.quotas) {
        const metrics = result.performance.metrics.find((m: any) => m.companyId === quota.companyId);
        if (metrics) {
          tenantData.push({ metrics, quota });
        }
      }

      setTenants(tenantData);
    } catch (error) {
      console.error('Failed to load tenant performance:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenant performance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (current: number, max: number): number => {
    return Math.min((current / max) * 100, 100);
  };

  const getStatusColor = (percentage: number): string => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 75) return 'secondary';
    return 'default';
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} MB`;
    return `${(bytes / 1024).toFixed(1)} GB`;
  };

  useEffect(() => {
    loadTenantPerformance();
    // Refresh every 60 seconds
    const interval = setInterval(loadTenantPerformance, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <BarChart3 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading tenant performance data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tenant Performance Monitoring
            </div>
            <Button variant="outline" size="sm" onClick={loadTenantPerformance} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Monitor resource usage and performance across all tenants
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Total tenants: {tenants.length}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active Users</TableHead>
                <TableHead>API Usage</TableHead>
                <TableHead>DB Connections</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Error Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const userUsage = getUsagePercentage(tenant.metrics.activeUsers, tenant.quota.maxConcurrentUsers);
                const apiUsage = getUsagePercentage(tenant.metrics.apiCallsThisHour, tenant.quota.maxApiCallsPerHour);
                const dbUsage = getUsagePercentage(tenant.metrics.databaseConnections, tenant.quota.maxDatabaseConnections);
                const memoryUsage = getUsagePercentage(tenant.metrics.memoryUsage, tenant.quota.maxMemoryUsage);
                const cpuUsage = getUsagePercentage(tenant.metrics.cpuUsage, tenant.quota.maxCpuUsage);

                const hasIssues = userUsage >= 90 || apiUsage >= 90 || memoryUsage >= 90 || cpuUsage >= 90 ||
                                tenant.metrics.errorRate > 0.05 || tenant.metrics.responseTimeAvg > 1000;

                return (
                  <TableRow key={tenant.quota.companyId}>
                    <TableCell className="font-mono text-sm">
                      {tenant.quota.companyId.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(tenant.quota.priority)}>
                        {tenant.quota.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{tenant.metrics.activeUsers}/{tenant.quota.maxConcurrentUsers}</div>
                        <Progress value={userUsage} className="w-16 h-1" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{tenant.metrics.apiCallsThisHour}/{tenant.quota.maxApiCallsPerHour}</div>
                        <Progress value={apiUsage} className="w-16 h-1" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{tenant.metrics.databaseConnections}/{tenant.quota.maxDatabaseConnections}</div>
                        <Progress value={dbUsage} className="w-16 h-1" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{formatBytes(tenant.metrics.memoryUsage)}/{formatBytes(tenant.quota.maxMemoryUsage)}</div>
                        <Progress value={memoryUsage} className="w-16 h-1" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{tenant.metrics.cpuUsage}%/{tenant.quota.maxCpuUsage}%</div>
                        <Progress value={cpuUsage} className="w-16 h-1" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {tenant.metrics.responseTimeAvg}ms
                        {tenant.metrics.responseTimeAvg > 1000 && (
                          <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {(tenant.metrics.errorRate * 100).toFixed(1)}%
                        {tenant.metrics.errorRate > 0.05 && (
                          <XCircle className="h-3 w-3 text-red-500 inline ml-1" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasIssues ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Issues
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Healthy
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed view for selected tenant */}
      {selectedTenant && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Performance - Tenant {selectedTenant.slice(0, 8)}...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Detailed tenant performance view coming soon...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\tenant-performance-dashboard.tsx