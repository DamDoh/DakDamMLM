'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Tooltip, Legend, RadialBar, RadialBarChart } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
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
  Zap,
  RefreshCw,
  Search,
  Users as UsersIcon,
  PieChart as PieChartIcon,
  LayoutDashboard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import CompanyDetailsModal from '@/components/super-admin/company-details-modal';
import SystemSettingsModal from '@/components/super-admin/system-settings-modal';
import SystemDiagnosticsModal from '@/components/super-admin/system-diagnostics-modal';
import SecurityAuditModal from '@/components/super-admin/security-audit-modal';
import SystemLogsModal from '@/components/super-admin/system-logs-modal';

interface SystemStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalRevenue: number;
  monthlyRevenue?: number;
  monthlyGrowth: number;
  systemHealth: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  apiLatency: number;
  activeAlerts: number;
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

interface ChartDataPoint {
  month: string;
  revenue: number;
  users: number;
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
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isSecurityAuditModalOpen, setIsSecurityAuditModalOpen] = useState(false);
  const [isSystemLogsModalOpen, setIsSystemLogsModalOpen] = useState(false);
  const [revenueChartData, setRevenueChartData] = useState<ChartDataPoint[]>([]);
  const [userGrowthChartData, setUserGrowthChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Generate chart data from stats and companies
  useEffect(() => {
    if (stats && companies.length > 0) {
      generateChartData();
    }
  }, [stats, companies]);

   const generateChartData = () => {
     if (!stats) return;

     // Generate last 12 months of data for better visualization
     const months: ChartDataPoint[] = [];
     const now = new Date();
     
     for (let i = 11; i >= 0; i--) {
       const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
       
       // Calculate estimated values based on current stats and growth
       const growthFactor = 1 + (stats.monthlyGrowth / 100) * (11 - i) / 2; // More gradual growth
       const baseRevenue = stats.totalRevenue / 12; // Distribute total revenue across 12 months
       const baseUsers = stats.totalUsers / 12; // Distribute total users across 12 months
       
       months.push({
         month: monthName,
         revenue: Math.round(baseRevenue * growthFactor),
         users: Math.round(baseUsers * growthFactor),
       });
     }
     
     setRevenueChartData(months);
     setUserGrowthChartData(months);
   };

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const headers = getAuthHeaders();

      // Load system statistics
      const statsResponse = await fetch('/api/super-admin/stats', {
        headers,
      });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      } else if (statsResponse.status === 401) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to access the super admin dashboard.',
        });
      }

      // Load companies overview
      const companiesResponse = await fetch('/api/super-admin/companies', {
        headers,
      });
      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json();
        // Handle different response formats
        if (Array.isArray(companiesData)) {
          setCompanies(companiesData);
        } else if (companiesData.data && Array.isArray(companiesData.data)) {
          setCompanies(companiesData.data);
        } else if (companiesData.companies && Array.isArray(companiesData.companies)) {
          setCompanies(companiesData.companies);
        } else {
          console.warn('Unexpected companies data format:', companiesData);
          setCompanies([]);
        }
      } else {
        setCompanies([]);
      }

      // Load system alerts
      const alertsResponse = await fetch('/api/super-admin/alerts', {
        headers,
      });
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
        headers: getAuthHeaders(),
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
          <Button variant="outline" onClick={() => setIsSystemSettingsOpen(true)}>
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
              <div className="text-2xl font-bold">${(stats.monthlyRevenue || stats.totalRevenue || 0).toLocaleString()}</div>
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
                  {Array.isArray(companies) && companies.length > 0 ? (
                    companies.map((company) => {
                      return (
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
                              console.log('View Details clicked for company:', company.id);
                              setSelectedCompany(company.id);
                              setIsCompanyModalOpen(true);
                              console.log('Modal state set - isOpen:', true, 'companyId:', company.id);
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
                    );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {loading ? t('common.loading') : t('superAdmin.noCompanies')}
                      </TableCell>
                    </TableRow>
                  )}
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
                {revenueChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      revenue: {
                        label: t('superAdmin.revenue') || 'Revenue',
                        color: 'hsl(var(--chart-1))',
                      },
                    } satisfies ChartConfig}
                    className="h-64 w-full"
                  >
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value.slice(0, 3)}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="var(--color-revenue)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mr-2" />
                    {t('common.loading') || 'Loading chart data...'}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('superAdmin.userGrowthChart')}</CardTitle>
                <CardDescription>{t('superAdmin.registrationTrends')}</CardDescription>
              </CardHeader>
              <CardContent>
                {userGrowthChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      users: {
                        label: t('superAdmin.users') || 'Users',
                        color: 'hsl(var(--chart-2))',
                      },
                    } satisfies ChartConfig}
                    className="h-64 w-full"
                  >
                    <LineChart data={userGrowthChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value.slice(0, 3)}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="var(--color-users)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mr-2" />
                    {t('common.loading') || 'Loading chart data...'}
                  </div>
                )}
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
          {/* Billing Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('superAdmin.totalRevenue') || 'Total Revenue'}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${companies.reduce((sum, company) => sum + company.revenue, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('superAdmin.allTimeRevenue') || 'All-time revenue from all companies'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('superAdmin.activeSubscriptions') || 'Active Subscriptions'}</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {companies.filter(c => c.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('superAdmin.companiesWithActivePlans') || 'Companies with active subscription plans'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('superAdmin.monthlyRecurring') || 'Monthly Recurring'}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(companies.filter(c => c.status === 'active').length * 99).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('superAdmin.estimatedMonthlyRevenue') || 'Estimated monthly recurring revenue'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Billing Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('superAdmin.billingOverview')}</CardTitle>
              <CardDescription>
                {t('superAdmin.subscriptionPayments')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {companies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('superAdmin.company')}</TableHead>
                      <TableHead>{t('superAdmin.subscription')}</TableHead>
                      <TableHead>{t('superAdmin.status')}</TableHead>
                      <TableHead>{t('superAdmin.users')}</TableHead>
                      <TableHead>{t('superAdmin.revenue')}</TableHead>
                      <TableHead>{t('superAdmin.lastPayment') || 'Last Payment'}</TableHead>
                      <TableHead>{t('superAdmin.nextBilling') || 'Next Billing'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => {
                      // Calculate next billing date (30 days from last activity or creation)
                      const lastDate = new Date(company.lastActivity || company.createdAt);
                      const nextBilling = new Date(lastDate);
                      nextBilling.setDate(nextBilling.getDate() + 30);
                      
                      return (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {company.logoUrl && (
                                <Image
                                  src={company.logoUrl}
                                  alt={company.name}
                                  width={24}
                                  height={24}
                                  className="rounded"
                                />
                              )}
                              {company.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{company.subscriptionTier}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(company.status)}>
                              {company.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{company.userCount} {t('superAdmin.members')}</TableCell>
                          <TableCell className="font-semibold">${company.revenue.toLocaleString()}</TableCell>
                          <TableCell>
                            {new Date(company.lastActivity).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className={nextBilling < new Date() ? 'text-red-600 font-semibold' : ''}>
                              {nextBilling.toLocaleDateString()}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4" />
                  <p>{t('superAdmin.noCompaniesFound') || 'No companies found'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('superAdmin.systemPerformance')}</CardTitle>
                <CardDescription>{t('superAdmin.serverHealthMetrics')}</CardDescription>
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
                <CardTitle>{t('superAdmin.systemActions')}</CardTitle>
                <CardDescription>{t('superAdmin.adminControls')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    console.log('Run System Diagnostics clicked');
                    setIsDiagnosticsModalOpen(true);
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {t('superAdmin.runDiagnostics')}
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    console.log('Security Audit clicked');
                    setIsSecurityAuditModalOpen(true);
                  }}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {t('superAdmin.securityAudit')}
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    console.log('View System Logs clicked');
                    setIsSystemLogsModalOpen(true);
                  }}
                >
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
        onActionSuccess={() => {
          // Refresh the company list after successful action
          loadDashboardData();
        }}
      />

      {/* System Settings Modal */}
      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
      />

      {/* System Diagnostics Modal */}
      <SystemDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
      />

      {/* Security Audit Modal */}
      <SecurityAuditModal
        isOpen={isSecurityAuditModalOpen}
        onClose={() => setIsSecurityAuditModalOpen(false)}
      />

      {/* System Logs Modal */}
      <SystemLogsModal
        isOpen={isSystemLogsModalOpen}
        onClose={() => setIsSystemLogsModalOpen(false)}
      />
    </div>
  );
}