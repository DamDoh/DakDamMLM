'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Users,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemHealthMetrics {
  databaseStatus: 'healthy' | 'warning' | 'critical';
  apiResponseTime: number;
  activeUsers: number;
  pendingAlerts: number;
  serverLoad: number;
  lastUpdated: string;
}

export function SystemHealthBar() {
  const [metrics, setMetrics] = useState<SystemHealthMetrics>({
    databaseStatus: 'healthy',
    apiResponseTime: 0,
    activeUsers: 0,
    pendingAlerts: 0,
    serverLoad: 0,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadSystemHealth = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll simulate health data
      const response = await fetch('/api/health');
      if (response.ok) {
        const healthData = await response.json();

        setMetrics({
          databaseStatus: healthData.database?.status === 'up' ? 'healthy' : 'critical',
          apiResponseTime: healthData.api?.responseTime || 0,
          activeUsers: healthData.users?.active || 0,
          pendingAlerts: healthData.alerts?.pending || 0,
          serverLoad: healthData.server?.load || 0,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
      // Set default values on error
      setMetrics(prev => ({
        ...prev,
        lastUpdated: new Date().toISOString()
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemHealth();
    // Refresh every 30 seconds
    const interval = setInterval(loadSystemHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-sm">System Health</h3>

            <div className="flex items-center gap-3">
              {/* Database Status */}
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className={`text-xs ${getStatusColor(metrics.databaseStatus)}`}>
                  {getStatusIcon(metrics.databaseStatus)}
                  <span className="ml-1 capitalize">{metrics.databaseStatus}</span>
                </Badge>
              </div>

              {/* API Response Time */}
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  API: {metrics.apiResponseTime}ms
                </span>
              </div>

              {/* Active Users */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {metrics.activeUsers} users
                </span>
              </div>

              {/* Pending Alerts */}
              {metrics.pendingAlerts > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <Badge variant="destructive" className="text-xs">
                    {metrics.pendingAlerts} alerts
                  </Badge>
                </div>
              )}

              {/* Server Load */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Load: {metrics.serverLoad.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Updated {new Date(metrics.lastUpdated).toLocaleTimeString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSystemHealth}
              disabled={loading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\system-health-bar.tsx