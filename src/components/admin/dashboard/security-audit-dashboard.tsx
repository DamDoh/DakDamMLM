'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Shield,
  Eye,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  UserPlus,
  Settings,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { format } from 'date-fns';

interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  companyId?: string;
  createdAt: string;
  user?: {
    memberId: string;
    firstName: string;
    surname: string;
    accountType: string;
  };
}

export function SecurityAuditDashboard() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    userId: '',
    dateRange: '24h',
    severity: ''
  });
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const { toast } = useToast();
  const { t } = useI18n();

  // Load audit logs
  const loadAuditLogs = useCallback(async (resetData = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams({
        page: resetData ? '0' : page.toString(),
        pageSize: '100',
        search: searchTerm,
        ...filters
      });

      const response = await fetch(`/api/security/audit-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load audit logs');
      }

      const result = await response.json();

      if (resetData) {
        setLogs(result.logs);
      } else {
        setLogs(prev => [...prev, ...result.logs]);
      }

      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filters, toast]);

  // Handle real-time updates
  useEffect(() => {
    if (!realTimeEnabled) return;

    const interval = setInterval(() => {
      loadAuditLogs(true);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [realTimeEnabled, loadAuditLogs]);

  // Load data when dependencies change
  useEffect(() => {
    loadAuditLogs(page === 0);
  }, [loadAuditLogs, page]);

  // Get action icon
  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login')) return <LogIn className="h-4 w-4 text-green-500" />;
    if (actionLower.includes('logout')) return <LogOut className="h-4 w-4 text-gray-500" />;
    if (actionLower.includes('create') || actionLower.includes('add')) return <UserPlus className="h-4 w-4 text-blue-500" />;
    if (actionLower.includes('update') || actionLower.includes('edit')) return <Edit className="h-4 w-4 text-yellow-500" />;
    if (actionLower.includes('delete') || actionLower.includes('remove')) return <Trash2 className="h-4 w-4 text-red-500" />;
    if (actionLower.includes('view') || actionLower.includes('read')) return <Eye className="h-4 w-4 text-blue-500" />;
    if (actionLower.includes('setting') || actionLower.includes('config')) return <Settings className="h-4 w-4 text-purple-500" />;
    return <Shield className="h-4 w-4 text-gray-500" />;
  };

  // Get severity badge
  const getSeverityBadge = (action: string, entity: string) => {
    const actionLower = action.toLowerCase();
    const entityLower = entity.toLowerCase();

    // High severity actions
    if (actionLower.includes('delete') || actionLower.includes('suspend') ||
        entityLower.includes('user') && actionLower.includes('admin')) {
      return <Badge variant="destructive">High</Badge>;
    }

    // Medium severity actions
    if (actionLower.includes('update') || actionLower.includes('create') ||
        entityLower.includes('setting')) {
      return <Badge variant="secondary">Medium</Badge>;
    }

    // Low severity actions
    return <Badge variant="outline">Low</Badge>;
  };

  // Format changes for display
  const formatChanges = (changes: any) => {
    if (!changes) return 'No changes recorded';

    try {
      const changesObj = typeof changes === 'string' ? JSON.parse(changes) : changes;

      if (changesObj.before && changesObj.after) {
        const changedFields = Object.keys(changesObj.after).filter(
          key => JSON.stringify(changesObj.before[key]) !== JSON.stringify(changesObj.after[key])
        );

        return `Modified: ${changedFields.join(', ')}`;
      }

      return JSON.stringify(changesObj, null, 2);
    } catch {
      return String(changes);
    }
  };

  // Export logs
  const exportLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams({
        format: 'csv',
        search: searchTerm,
        ...filters
      });

      const response = await fetch(`/api/security/audit-logs/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export logs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Complete',
        description: 'Audit logs have been downloaded successfully',
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export audit logs',
        variant: 'destructive',
      });
    }
  }, [searchTerm, filters, toast]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
    setLogs([]);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setPage(0);
    setLogs([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Audit Logs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={realTimeEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setRealTimeEnabled(!realTimeEnabled)}
            >
              {realTimeEnabled ? <CheckCircle className="h-4 w-4 mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
              Real-time {realTimeEnabled ? 'On' : 'Off'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadAuditLogs(true)}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Real-time security audit trail with advanced filtering and compliance reporting
        </p>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={filters.action} onValueChange={(value) => handleFilterChange('action', value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Actions</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="view">View</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.entity} onValueChange={(value) => handleFilterChange('entity', value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Entities</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="commission">Commission</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">Total Events</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {logs.filter(l => l.action.toLowerCase().includes('delete') || l.action.toLowerCase().includes('suspend')).length}
              </div>
              <p className="text-xs text-muted-foreground">High Risk Actions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {logs.filter(l => l.action.toLowerCase().includes('update')).length}
              </div>
              <p className="text-xs text-muted-foreground">Modifications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {logs.filter(l => l.action.toLowerCase().includes('login')).length}
              </div>
              <p className="text-xs text-muted-foreground">Auth Events</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-96 w-full border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {getActionIcon(log.action)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">
                        {log.user ? `${log.user.firstName} ${log.user.surname}` : 'System'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.user?.memberId || 'N/A'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.entity}
                    {log.entityId && (
                      <span className="text-muted-foreground ml-1">
                        ({log.entityId.slice(0, 8)}...)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getSeverityBadge(log.action, log.entity)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.ipAddress || 'N/A'}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-xs text-muted-foreground truncate">
                      {formatChanges(log.changes)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {loading && (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading more logs...</span>
            </div>
          )}

          {!hasMore && logs.length > 0 && (
            <div className="text-center p-4 text-muted-foreground">
              End of audit logs
            </div>
          )}

          {logs.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No audit logs found
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\security-audit-dashboard.tsx