'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Server,
  Database,
  HardDrive,
  Cpu,
  Activity,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticResult {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface SystemDiagnostics {
  overall: 'healthy' | 'warning' | 'error';
  services: DiagnosticResult[];
  metrics: {
    uptime: string;
    cpu: number;
    memory: number;
    disk: number;
  };
  alerts: Array<{
    id: string;
    severity: 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

export default function SystemDiagnosticsModal({ isOpen, onClose }: SystemDiagnosticsModalProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (isOpen && !diagnostics) {
      runDiagnostics();
    }
  }, [isOpen]);

  const runDiagnostics = async () => {
    try {
      setRunning(true);
      setLoading(true);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/super-admin/diagnostics', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDiagnostics(data.data || data);
      
      toast({
        title: t('superAdmin.diagnostics.complete'),
        description: t('superAdmin.diagnostics.completeDescription'),
      });
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
      toast({
        variant: 'destructive',
        title: t('superAdmin.diagnostics.errorTitle'),
        description: error instanceof Error ? error.message : t('superAdmin.diagnostics.errorDescription'),
      });
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">{t('superAdmin.diagnostics.healthy')}</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">{t('superAdmin.diagnostics.warning')}</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">{t('superAdmin.diagnostics.error')}</Badge>;
      default:
        return <Badge variant="outline">{t('superAdmin.diagnostics.unknown')}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6" />
            {t('superAdmin.diagnostics.title')}
          </DialogTitle>
          <DialogDescription>
            {t('superAdmin.diagnostics.description')}
          </DialogDescription>
        </DialogHeader>

        {loading && !diagnostics ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('superAdmin.diagnostics.running')}</p>
          </div>
        ) : diagnostics ? (
          <div className="space-y-6">
            {/* Overall Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t('superAdmin.diagnostics.overallStatus')}</span>
                  {getStatusBadge(diagnostics.overall)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnostics.overall)}
                  <span className="text-lg font-medium">
                    {diagnostics.overall === 'healthy' ? t('superAdmin.diagnostics.operatingNormally') : diagnostics.overall === 'warning' ? t('superAdmin.diagnostics.minorIssues') : t('superAdmin.diagnostics.criticalIssues')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* System Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {t('superAdmin.diagnostics.systemMetrics')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t('superAdmin.diagnostics.uptime')}</span>
                      </div>
                      <p className="text-lg font-semibold">{diagnostics.metrics.uptime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t('superAdmin.cpuUsage')}</span>
                        <span>{diagnostics.metrics.cpu}%</span>
                      </div>
                      <Progress value={diagnostics.metrics.cpu} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t('superAdmin.memoryUsage')}</span>
                        <span>{diagnostics.metrics.memory}%</span>
                      </div>
                      <Progress value={diagnostics.metrics.memory} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t('superAdmin.storageUsage')}</span>
                        <span>{diagnostics.metrics.disk}%</span>
                      </div>
                      <Progress value={diagnostics.metrics.disk} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Status */}
            <Card>
              <CardHeader>
                <CardTitle>{t('superAdmin.diagnostics.serviceStatus')}</CardTitle>
                <CardDescription>{t('superAdmin.diagnostics.serviceStatusDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {diagnostics.services.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(service.status)}
                        <div>
                          <p className="font-medium">{service.service}</p>
                          <p className="text-sm text-muted-foreground">{service.message}</p>
                        </div>
                      </div>
                      {getStatusBadge(service.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Alerts */}
            {diagnostics.alerts && diagnostics.alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {t('superAdmin.diagnostics.activeAlerts')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {diagnostics.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${
                          alert.severity === 'error'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {alert.severity === 'error' ? (
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                {t('superAdmin.diagnostics.close')}
              </Button>
              <Button onClick={runDiagnostics} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('superAdmin.diagnostics.running')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('superAdmin.diagnostics.runAgain')}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t('superAdmin.diagnostics.clickToStart')}</p>
            <Button onClick={runDiagnostics} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('superAdmin.diagnostics.running')}
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  {t('superAdmin.diagnostics.runDiagnostics')}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

