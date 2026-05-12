'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Lock,
  Key,
  Eye,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SecurityCheck {
  category: string;
  check: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

interface SecurityAudit {
  overall: 'secure' | 'warning' | 'critical';
  score: number;
  checks: SecurityCheck[];
  vulnerabilities: Array<{
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  lastAudit: string;
}

export default function SecurityAuditModal({ isOpen, onClose }: SecurityAuditModalProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [audit, setAudit] = useState<SecurityAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (isOpen && !audit) {
      runSecurityAudit();
    }
  }, [isOpen]);

  const runSecurityAudit = async () => {
    try {
      setRunning(true);
      setLoading(true);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/super-admin/security-audit', {
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
      setAudit(data.data || data);
      
      toast({
        title: 'Security Audit Complete',
        description: 'Security audit has been completed successfully.',
      });
    } catch (error) {
      console.error('Failed to run security audit:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run security audit.',
      });
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">Pass</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">Fail</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getOverallBadge = (overall: string) => {
    switch (overall) {
      case 'secure':
        return <Badge className="bg-green-100 text-green-800">Secure</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Needs Attention</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800">Critical Issues</Badge>;
      default:
        return <Badge variant="outline">{overall}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security Audit
          </DialogTitle>
          <DialogDescription>
            Comprehensive security assessment and vulnerability analysis
          </DialogDescription>
        </DialogHeader>

        {loading && !audit ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Running security audit...</p>
          </div>
        ) : audit ? (
          <div className="space-y-6">
            {/* Overall Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Overall Security Status</span>
                  {getOverallBadge(audit.overall)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <span className="text-lg font-medium">
                      Security Score: {audit.score}/100
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last audit: {new Date(audit.lastAudit).toLocaleString()}
                  </div>
                </div>
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      audit.score >= 80
                        ? 'bg-green-600'
                        : audit.score >= 60
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${audit.score}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            {/* Security Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Security Checks</CardTitle>
                <CardDescription>Detailed security assessment results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    audit.checks.reduce((acc, check) => {
                      if (!acc[check.category]) {
                        acc[check.category] = [];
                      }
                      acc[check.category].push(check);
                      return acc;
                    }, {} as Record<string, SecurityCheck[]>)
                  ).map(([category, checks]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        {category === 'Authentication' && <Key className="h-4 w-4" />}
                        {category === 'Authorization' && <Lock className="h-4 w-4" />}
                        {category === 'Data Protection' && <Shield className="h-4 w-4" />}
                        {category === 'Network Security' && <Eye className="h-4 w-4" />}
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {checks.map((check, index) => (
                          <div
                            key={index}
                            className="flex items-start justify-between p-2 rounded border bg-muted/50"
                          >
                            <div className="flex items-start gap-2 flex-1">
                              {getStatusIcon(check.status)}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{check.check}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {check.message}
                                </p>
                                {check.recommendation && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    💡 {check.recommendation}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {check.severity && getSeverityBadge(check.severity)}
                              {getStatusBadge(check.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Vulnerabilities */}
            {audit.vulnerabilities && audit.vulnerabilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Identified Vulnerabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {audit.vulnerabilities.map((vuln) => (
                      <div
                        key={vuln.id}
                        className={`p-4 rounded-lg border ${
                          vuln.severity === 'critical'
                            ? 'bg-red-50 border-red-200'
                            : vuln.severity === 'high'
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold">{vuln.title}</h4>
                          {getSeverityBadge(vuln.severity)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {vuln.description}
                        </p>
                        <div className="mt-2 p-2 bg-white rounded border-l-2 border-blue-500">
                          <p className="text-xs font-medium text-blue-700">
                            Recommendation:
                          </p>
                          <p className="text-xs text-blue-600 mt-1">{vuln.recommendation}</p>
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
                Close
              </Button>
              <Button onClick={runSecurityAudit} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Again
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Click "Run Security Audit" to start</p>
            <Button onClick={runSecurityAudit} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Run Security Audit
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

