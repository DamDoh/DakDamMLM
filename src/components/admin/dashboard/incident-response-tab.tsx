'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  AlertTriangle,
  Play,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface IncidentResponseCapabilities {
  supportedIncidentTypes: string[];
  supportedSeverities: string[];
  automatedActions: string[];
}

export function IncidentResponseTab() {
  const [capabilities, setCapabilities] = useState<IncidentResponseCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [testIncidentLoading, setTestIncidentLoading] = useState(false);
  const [incidentType, setIncidentType] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { t } = useI18n();

  const loadCapabilities = async () => {
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

      const response = await fetch('/api/incident-response', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load capabilities');
      }

      const result = await response.json();
      setCapabilities(result.capabilities);
    } catch (error) {
      console.error('Failed to load capabilities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load incident response capabilities',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerTestIncident = async () => {
    setTestIncidentLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/incident-response', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_test_incident'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger test incident');
      }

      const result = await response.json();

      toast({
        title: 'Test Incident Created',
        description: 'Automated incident response has been triggered. Check notifications for updates.',
      });

      // Reset form
      setIncidentType('');
      setSeverity('');
      setDescription('');
    } catch (error) {
      console.error('Failed to trigger test incident:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger test incident',
        variant: 'destructive',
      });
    } finally {
      setTestIncidentLoading(false);
    }
  };

  const triggerManualIncident = async () => {
    if (!incidentType || !severity || !description) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/incident-response', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'detect_incident',
          incidentType,
          severity,
          description,
          data: { manual: true }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger incident');
      }

      const result = await response.json();

      toast({
        title: 'Incident Detected',
        description: 'Automated incident response has been initiated.',
      });

      // Reset form
      setIncidentType('');
      setSeverity('');
      setDescription('');
    } catch (error) {
      console.error('Failed to trigger incident:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger incident response',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Automated Incident Response System
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure and monitor automated responses to security incidents and system anomalies
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={loadCapabilities} disabled={loading} variant="outline">
              {loading ? 'Loading...' : 'Load System Status'}
            </Button>
            {capabilities && (
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                System Active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Incident */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Test Incident Response
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Trigger a test incident to verify automated response systems
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm">
              This will create a simulated security incident and trigger all automated response actions.
              Use this to test the incident response system without affecting real operations.
            </p>
            <Button
              onClick={triggerTestIncident}
              disabled={testIncidentLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {testIncidentLoading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Creating Test Incident...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Trigger Test Incident
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Incident Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Manual Incident Detection
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manually trigger incident response for detected issues
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incident-type">Incident Type</Label>
                <Select value={incidentType} onValueChange={setIncidentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select incident type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="security_breach">Security Breach</SelectItem>
                    <SelectItem value="system_failure">System Failure</SelectItem>
                    <SelectItem value="performance_degradation">Performance Degradation</SelectItem>
                    <SelectItem value="data_anomaly">Data Anomaly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <Badge variant="outline">Low</Badge>
                    </SelectItem>
                    <SelectItem value="medium">
                      <Badge variant="secondary">Medium</Badge>
                    </SelectItem>
                    <SelectItem value="high">
                      <Badge variant="destructive">High</Badge>
                    </SelectItem>
                    <SelectItem value="critical">
                      <Badge variant="destructive">Critical</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the incident and any relevant details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={triggerManualIncident}
              disabled={loading || !incidentType || !severity || !description}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Triggering Response...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Trigger Incident Response
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Response Capabilities */}
      {capabilities && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Supported Incident Types</h4>
                <div className="flex flex-wrap gap-2">
                  {capabilities.supportedIncidentTypes.map((type) => (
                    <Badge key={type} variant="outline">
                      {type.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Automated Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {capabilities.automatedActions.map((action) => (
                    <Badge key={action} variant="secondary">
                      {action.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\incident-response-tab.tsx