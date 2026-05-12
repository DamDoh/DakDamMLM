'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Plus, Edit, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface PerformanceAlert {
  id: string;
  name: string;
  enabled: boolean;
  metric: 'execution_time' | 'error_rate' | 'success_rate' | 'amount_paid';
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals';
  notificationChannels: ('email' | 'in_app' | 'sms')[];
  recipients: string[];
  ruleId?: string; // Optional: specific rule, or null for all rules
}

export function PerformanceAlerts() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PerformanceAlert | null>(null);
  const [alertForm, setAlertForm] = useState<Omit<PerformanceAlert, 'id'>>({
    name: '',
    enabled: true,
    metric: 'execution_time',
    threshold: 100,
    operator: 'greater_than',
    notificationChannels: ['in_app'],
    recipients: [],
    ruleId: undefined
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;

      // In a real implementation, fetch from API
      // For now, use localStorage
      const savedAlerts = localStorage.getItem('performance_alerts');
      if (savedAlerts) {
        setAlerts(JSON.parse(savedAlerts));
      } else {
        // Default alerts
        const defaultAlerts: PerformanceAlert[] = [
          {
            id: 'alert-1',
            name: 'High Execution Time Alert',
            enabled: true,
            metric: 'execution_time',
            threshold: 200,
            operator: 'greater_than',
            notificationChannels: ['email', 'in_app'],
            recipients: ['admin@example.com']
          },
          {
            id: 'alert-2',
            name: 'High Error Rate Alert',
            enabled: true,
            metric: 'error_rate',
            threshold: 5,
            operator: 'greater_than',
            notificationChannels: ['in_app'],
            recipients: []
          }
        ];
        setAlerts(defaultAlerts);
        localStorage.setItem('performance_alerts', JSON.stringify(defaultAlerts));
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const saveAlerts = (newAlerts: PerformanceAlert[]) => {
    setAlerts(newAlerts);
    localStorage.setItem('performance_alerts', JSON.stringify(newAlerts));
  };

  const handleCreateAlert = () => {
    setSelectedAlert(null);
    setAlertForm({
      name: '',
      enabled: true,
      metric: 'execution_time',
      threshold: 100,
      operator: 'greater_than',
      notificationChannels: ['in_app'],
      recipients: [],
      ruleId: undefined
    });
    setIsDialogOpen(true);
  };

  const handleEditAlert = (alert: PerformanceAlert) => {
    setSelectedAlert(alert);
    setAlertForm({
      name: alert.name,
      enabled: alert.enabled,
      metric: alert.metric,
      threshold: alert.threshold,
      operator: alert.operator,
      notificationChannels: alert.notificationChannels,
      recipients: alert.recipients,
      ruleId: alert.ruleId
    });
    setIsDialogOpen(true);
  };

  const handleSaveAlert = () => {
    if (!alertForm.name.trim()) {
      toast({
        variant: 'destructive',
        title: t('businessRules.validationError'),
        description: t('businessRules.alertNameRequired'),
      });
      return;
    }

    if (selectedAlert) {
      // Update
      const updated = alerts.map(a => a.id === selectedAlert.id ? { ...selectedAlert, ...alertForm } : a);
      saveAlerts(updated);
      toast({
        title: t('businessRules.alertUpdated'),
        description: t('businessRules.alertUpdatedDesc', { name: alertForm.name }),
      });
    } else {
      // Create
      const newAlert: PerformanceAlert = {
        id: `alert-${Date.now()}`,
        ...alertForm
      };
      saveAlerts([...alerts, newAlert]);
      toast({
        title: t('businessRules.alertCreated'),
        description: t('businessRules.alertCreatedDesc', { name: alertForm.name }),
      });
    }

    setIsDialogOpen(false);
  };

  const handleDeleteAlert = (alert: PerformanceAlert) => {
    if (!confirm(t('businessRules.confirmDeleteAlert', { name: alert.name }))) return;
    
    const updated = alerts.filter(a => a.id !== alert.id);
    saveAlerts(updated);
    toast({
      title: t('businessRules.alertDeleted'),
      description: t('businessRules.alertDeletedDesc', { name: alert.name }),
    });
  };

  const toggleAlert = (alert: PerformanceAlert) => {
    const updated = alerts.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a);
    saveAlerts(updated);
    toast({
      title: alert.enabled ? t('businessRules.alertDisabled') : t('businessRules.alertEnabled'),
      description: alert.enabled ? t('businessRules.alertDisabledDesc', { name: alert.name }) : t('businessRules.alertEnabledDesc', { name: alert.name }),
    });
  };

  const toggleChannel = (channel: 'email' | 'in_app' | 'sms') => {
    const channels = alertForm.notificationChannels.includes(channel)
      ? alertForm.notificationChannels.filter(c => c !== channel)
      : [...alertForm.notificationChannels, channel];
    setAlertForm({ ...alertForm, notificationChannels: channels });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Bell className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('businessRules.performanceAlertsHeader')}</strong> {t('businessRules.performanceAlertsDesc')}
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('businessRules.performanceAlertsTitle')}</h2>
          <p className="text-muted-foreground">
            {t('businessRules.configureAutomatedAlerts')}
          </p>
        </div>
        <Button onClick={handleCreateAlert}>
          <Plus className="h-4 w-4 mr-2" />
          {t('businessRules.createAlert')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('businessRules.activeAlerts')}</CardTitle>
          <CardDescription>
            {t('businessRules.alertsConfigured', { count: alerts.length.toString() })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('businessRules.noAlertsConfigured')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('businessRules.createFirstAlert')}
              </p>
              <Button onClick={handleCreateAlert}>
                <Plus className="h-4 w-4 mr-2" />
                {t('businessRules.createAlert')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('businessRules.name')}</TableHead>
                  <TableHead>{t('businessRules.metric')}</TableHead>
                  <TableHead>{t('businessRules.threshold')}</TableHead>
                  <TableHead>{t('businessRules.channels')}</TableHead>
                  <TableHead>{t('businessRules.status')}</TableHead>
                  <TableHead>{t('businessRules.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map(alert => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">{alert.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {alert.metric === 'execution_time' ? t('businessRules.executionTime') :
                         alert.metric === 'error_rate' ? t('businessRules.errorRate') :
                         alert.metric === 'success_rate' ? t('businessRules.successRateMetric') :
                         alert.metric === 'amount_paid' ? t('businessRules.amountPaid') :
                         String(alert.metric).replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {alert.operator === 'greater_than' && '>'}
                      {alert.operator === 'less_than' && '<'}
                      {alert.operator === 'equals' && '='}
                      {' '}{alert.threshold}
                      {alert.metric === 'execution_time' && 'ms'}
                      {alert.metric === 'error_rate' && '%'}
                      {alert.metric === 'success_rate' && '%'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {alert.notificationChannels.map(channel => (
                          <Badge key={channel} variant="secondary" className="text-xs">
                            {channel === 'email' ? t('businessRules.email') :
                             channel === 'in_app' ? t('businessRules.inApp') :
                             channel === 'sms' ? t('businessRules.sms') :
                             channel}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.enabled}
                          onCheckedChange={() => toggleAlert(alert)}
                        />
                        {alert.enabled ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {t('businessRules.active')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {t('businessRules.inactive')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAlert(alert)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {t('businessRules.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAlert(alert)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('businessRules.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Alert Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedAlert ? t('businessRules.editAlert') : t('businessRules.createNewAlert')}
            </DialogTitle>
            <DialogDescription>
              {t('businessRules.configureAlertThresholds')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="alert-name">{t('businessRules.alertName')} *</Label>
              <Input
                id="alert-name"
                value={alertForm.name}
                onChange={(e) => setAlertForm({ ...alertForm, name: e.target.value })}
                placeholder={t('businessRules.alertNamePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="alert-metric">{t('businessRules.metric')}</Label>
                <Select
                  value={alertForm.metric}
                  onValueChange={(value: any) => setAlertForm({ ...alertForm, metric: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="execution_time">{t('businessRules.executionTimeMs')}</SelectItem>
                    <SelectItem value="error_rate">{t('businessRules.errorRatePercent')}</SelectItem>
                    <SelectItem value="success_rate">{t('businessRules.successRatePercent')}</SelectItem>
                    <SelectItem value="amount_paid">{t('businessRules.amountPaidAlert')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="alert-operator">{t('businessRules.operator')}</Label>
                <Select
                  value={alertForm.operator}
                  onValueChange={(value: any) => setAlertForm({ ...alertForm, operator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greater_than">{t('businessRules.greaterThan')}</SelectItem>
                    <SelectItem value="less_than">{t('businessRules.lessThan')}</SelectItem>
                    <SelectItem value="equals">{t('businessRules.equals')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="alert-threshold">{t('businessRules.threshold')}</Label>
              <Input
                id="alert-threshold"
                type="number"
                step="0.01"
                min="0"
                value={alertForm.threshold}
                onChange={(e) => setAlertForm({ ...alertForm, threshold: parseFloat(e.target.value) || 0 })}
                placeholder={t('businessRules.enterThresholdValue')}
              />
            </div>

            <div>
              <Label>{t('businessRules.notificationChannels')}</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={alertForm.notificationChannels.includes('in_app') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleChannel('in_app')}
                >
                  {t('businessRules.inApp')}
                </Button>
                <Button
                  type="button"
                  variant={alertForm.notificationChannels.includes('email') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleChannel('email')}
                >
                  {t('businessRules.email')}
                </Button>
                <Button
                  type="button"
                  variant={alertForm.notificationChannels.includes('sms') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleChannel('sms')}
                >
                  {t('businessRules.sms')}
                </Button>
              </div>
            </div>

            {alertForm.notificationChannels.includes('email') && (
              <div>
                <Label htmlFor="alert-recipients">{t('businessRules.emailRecipients')}</Label>
                <Input
                  id="alert-recipients"
                  value={alertForm.recipients.join(', ')}
                  onChange={(e) => setAlertForm({
                    ...alertForm,
                    recipients: e.target.value.split(',').map(r => r.trim()).filter(r => r)
                  })}
                  placeholder={t('businessRules.emailRecipientsPlaceholder')}
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="alert-enabled"
                checked={alertForm.enabled}
                onCheckedChange={(checked) => setAlertForm({ ...alertForm, enabled: checked })}
              />
              <Label htmlFor="alert-enabled">{t('businessRules.active')}</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveAlert}>
              {selectedAlert ? t('businessRules.updateAlert') : t('businessRules.createAlert')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

