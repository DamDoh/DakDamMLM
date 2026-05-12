'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  Crown,
  BarChart3,
  Activity,
  Shield,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import CompanyDetailsModal from '@/components/super-admin/company-details-modal';

interface SystemStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalRevenue: number;
  monthlyGrowth: number;
  systemHealth: number;
}
import Image from 'next/image';

interface CompanyOverview {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'suspended' | 'inactive';
  userCount: number;
  revenue: number;
  createdAt: string;
  lastActivity: string;
  subscriptionTier: string;
  logoUrl?: string;
}

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  companyId?: string;
  timestamp: string;
}

export default function SuperAdminDashboard() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load system statistics
      const statsResponse = await fetch('/api/super-admin/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load companies overview
      const companiesResponse = await fetch('/api/super-admin/companies');
      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json();
        setCompanies(companiesData);
      }

      // Load system alerts
      const alertsResponse = await fetch('/api/super-admin/alerts');
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load dashboard data.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleCompanyAction = async (companyId: string, action: string) => {
    try {
      const response = await fetch(`/api/super-admin/companies/${companyId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Company ${action} successfully.`,
        });
        loadDashboardData();
      } else {
        throw new Error('Action failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to ${action} company.`,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8 text-yellow-600" />
            {t('superAdmin.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('superAdmin.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDashboardData}>
            <Activity className="h-4 w-4 mr-2" />
            {t('superAdmin.refresh')}
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            {t('superAdmin.systemSettings')}
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('superAdmin.totalCompanies')}</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeCompanies} {t('superAdmin.activeCompanies').toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('superAdmin.totalUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {t('superAdmin.acrossAllCompanies')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('superAdmin.monthlyRevenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+{stats.monthlyGrowth}%</span> {t('superAdmin.fromLastMonth')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('superAdmin.systemHealth')}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.systemHealth}%</div>
              <Progress value={stats.systemHealth} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="companies">{t('superAdmin.companyManagement')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('superAdmin.systemAnalytics')}</TabsTrigger>
          <TabsTrigger value="alerts">{t('superAdmin.systemAlerts')}</TabsTrigger>
          <TabsTrigger value="billing">{t('superAdmin.billingManagement')}</TabsTrigger>
          <TabsTrigger value="system">{t('superAdmin.systemMaintenance')}</TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('superAdmin.companyManagement')}</CardTitle>
              <CardDescription>
                {t('superAdmin.monitorCompanies')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('superAdmin.company')}</TableHead>
                    <TableHead>{t('superAdmin.status')}</TableHead>
                    <TableHead>{t('superAdmin.users')}</TableHead>
                    <TableHead>{t('superAdmin.revenue')}</TableHead>
                    <TableHead>{t('superAdmin.subscription')}</TableHead>
                    <TableHead>{t('superAdmin.lastActivity')}</TableHead>
                    <TableHead>{t('superAdmin.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {company.logoUrl && (
                            <Image
                              src={company.logoUrl}
                              alt={company.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{company.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('superAdmin.joined')} {new Date(company.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(company.status)}>
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{company.userCount} {t('superAdmin.members')}</TableCell>
                      <TableCell>${company.revenue}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.subscriptionTier}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(company.lastActivity).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCompany(company.id);
                              setIsCompanyModalOpen(true);
                            }}
                            title={t('superAdmin.viewDetails')}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCompanyAction(company.id, 'suspend')}
                            disabled={company.status === 'suspended'}
                            title={t('superAdmin.suspend')}
                          >
                            <Shield className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('superAdmin.revenueTrends')}</CardTitle>
                <CardDescription>{t('superAdmin.monthlyRevenueAllCompanies')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mr-2" />
                  Revenue chart will be displayed here
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('superAdmin.userGrowthChart')}</CardTitle>
                <CardDescription>{t('superAdmin.registrationTrends')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mr-2" />
                  Growth chart will be displayed here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('superAdmin.systemAlerts')}</CardTitle>
              <CardDescription>
                {t('superAdmin.criticalNotifications')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('superAdmin.noAlerts')}</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-4 border rounded-lg">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('superAdmin.billingOverview')}</CardTitle>
              <CardDescription>
                {t('superAdmin.subscriptionPayments')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4" />
                Billing management interface will be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>Server health and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>{t('superAdmin.cpuUsage')}</span>
                    <span>45%</span>
                  </div>
                  <Progress value={45} />

                  <div className="flex justify-between items-center">
                    <span>{t('superAdmin.memoryUsage')}</span>
                    <span>67%</span>
                  </div>
                  <Progress value={67} />

                  <div className="flex justify-between items-center">
                    <span>{t('superAdmin.storageUsage')}</span>
                    <span>23%</span>
                  </div>
                  <Progress value={23} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Actions</CardTitle>
                <CardDescription>Administrative controls and maintenance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" variant="outline">
                  <Zap className="h-4 w-4 mr-2" />
                  {t('superAdmin.runDiagnostics')}
                </Button>
                <Button className="w-full" variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  {t('superAdmin.securityAudit')}
                </Button>
                <Button className="w-full" variant="outline">
                  <Activity className="h-4 w-4 mr-2" />
                  {t('superAdmin.viewLogs')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Company Details Modal */}
      <CompanyDetailsModal
        companyId={selectedCompany}
        isOpen={isCompanyModalOpen}
        onClose={() => {
          setIsCompanyModalOpen(false);
          setSelectedCompany(null);
        }}
      />
    </div>
  );
}