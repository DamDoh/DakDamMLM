'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Monitor, MapPin, Clock, AlertTriangle, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { format } from 'date-fns';

interface Session {
  id: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  riskScore: number;
  mfaVerified: boolean;
  startedAt: string;
  lastActivity: string;
  expiresAt: string;
  isCurrentSession?: boolean;
}

export function SessionManagementTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useI18n();

  const loadSessions = async () => {
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

      const response = await fetch('/api/user/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const result = await response.json();
      setSessions(result.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load active sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    setTerminatingSession(sessionId);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/user/sessions', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to terminate session');
      }

      toast({
        title: 'Success',
        description: 'Session terminated successfully',
      });

      // Reload sessions
      await loadSessions();
    } catch (error) {
      console.error('Failed to terminate session:', error);
      toast({
        title: 'Error',
        description: 'Failed to terminate session',
        variant: 'destructive',
      });
    } finally {
      setTerminatingSession(null);
    }
  };

  const getRiskBadgeColor = (riskScore: number) => {
    if (riskScore >= 80) return 'destructive';
    if (riskScore >= 50) return 'secondary';
    return 'default';
  };

  const getDeviceInfo = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile')) return 'Mobile';
    if (ua.includes('tablet')) return 'Tablet';
    return 'Desktop';
  };

  useEffect(() => {
    loadSessions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading session information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your active sessions across different devices and locations
          </p>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active sessions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{getDeviceInfo(session.userAgent)}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.isCurrentSession ? 'Current session' : 'Other device'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {session.location}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {session.ipAddress}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {format(new Date(session.lastActivity), 'MMM dd, HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={getRiskBadgeColor(session.riskScore)}>
                          Risk: {session.riskScore}
                        </Badge>
                        {session.mfaVerified && (
                          <Badge variant="outline" className="text-green-600">
                            MFA Verified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {!session.isCurrentSession && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => terminateSession(session.id)}
                          disabled={terminatingSession === session.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          {terminatingSession === session.id ? (
                            'Terminating...'
                          ) : (
                            <>
                              <LogOut className="h-4 w-4 mr-1" />
                              Terminate
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Security Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Regular Session Review</p>
                <p className="text-sm text-muted-foreground">
                  Review and terminate unrecognized sessions regularly
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium">High-Risk Sessions</p>
                <p className="text-sm text-muted-foreground">
                  Sessions with risk scores above 80 should be investigated
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium">MFA Protection</p>
                <p className="text-sm text-muted-foreground">
                  All administrative accounts are protected with mandatory MFA
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\session-management-tab.tsx