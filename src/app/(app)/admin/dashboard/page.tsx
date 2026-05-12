
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, MessageSquare, DollarSign, Users, Wallet, Package, ShoppingCart } from 'lucide-react';
import { useGenealogyContext } from '@/context/genealogy-context';
import { getPendingFinancialControls, getActiveComplianceDocuments, getAllMemberAgreements } from '@/services/dashboard-actions';
import { compressTree } from '@/services/server-actions';
import CommissionDisputes from '@/components/commission-disputes';
import { KeyMetricsCards } from '@/components/admin/dashboard/key-metrics-cards';
import { MemberManagementTab } from '@/components/admin/dashboard/member-management-tab';
import { FinancialControlsTab } from '@/components/admin/dashboard/financial-controls-tab';
import { ComplianceTab } from '@/components/admin/dashboard/compliance-tab';
import { AdvancedAnalyticsTab } from '@/components/admin/dashboard/advanced-analytics-tab';
import { SystemAlertsTab } from '@/components/admin/dashboard/system-alerts-tab';
import { SessionManagementTab } from '@/components/admin/dashboard/session-management-tab';
import { SystemHealthBar } from '@/components/admin/dashboard/system-health-bar';
import { RealTimeNotifications } from '@/components/admin/dashboard/real-time-notifications';
import { IncidentResponseTab } from '@/components/admin/dashboard/incident-response-tab';
import { VirtualGenealogyTree } from '@/components/admin/dashboard/virtual-genealogy-tree';
import { VirtualizedReport } from '@/components/admin/dashboard/virtualized-report';
import { TenantPerformanceDashboard } from '@/components/admin/dashboard/tenant-performance-dashboard';
import { SecurityAuditDashboard } from '@/components/admin/dashboard/security-audit-dashboard';
import { EnhancedReportingDashboard } from '@/components/admin/dashboard/enhanced-reporting-dashboard';
import { BulkUserManagement } from '@/components/admin/dashboard/bulk-user-management';
import type { Member, FinancialControl, ComplianceDocument, MemberAgreement, Order, Commission } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { formatCurrency } from '@/lib/utils';
import OnboardingProgress from '@/components/onboarding/onboarding-progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getOrderStatusBadge } from '@/lib/status-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get('tab') || 'overview';
  const { t } = useI18n();
  const context = useGenealogyContext();
  const members = context?.members || [];
  const { toast } = useToast();
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [financialControls, setFinancialControls] = useState<FinancialControl[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [agreements, setAgreements] = useState<MemberAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Dashboard data from regular dashboard
  const [dashboardData, setDashboardData] = useState<{
    commissions: Commission[];
    orders: Order[];
    metrics: {
      totalEarned: number;
      ecashBalance: number;
      totalMembers: number;
      totalOrders: number;
    };
  } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Update active tab when URL changes
  useEffect(() => {
    if (searchParams?.get('tab')) {
      setActiveTab(searchParams.get('tab')!);
    }
  }, [searchParams]);

  // Advanced Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [commissionAnalytics, setCommissionAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadBusinessData = useCallback(async () => {
    if (!context?.loading) {
      setLoading(true);
      try {
        const [controls, docs, memberAgreements] = await Promise.all([
          getPendingFinancialControls(),
          getActiveComplianceDocuments(),
          getAllMemberAgreements(undefined, undefined),
        ]);

        setFinancialControls(controls);
        setComplianceDocs(docs);
        setAgreements(memberAgreements);
      } catch (error: any) {
        console.error('Failed to load business data:', error);
        // Don't show toast for Firebase config errors - they're expected in development
        if (!error?.message?.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not load business intelligence data.' });
        }
      } finally {
        setLoading(false);
      }
    }
  }, [context?.loading, toast]);

  const loadAdvancedAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      // Fetch key metrics via API route to keep Prisma on the server only
      let keyMetrics: any[] = [];
      try {
        const res = await fetch('/api/analytics/key-metrics?period=month');
        if (res.ok) {
          const raw = await res.json();
          keyMetrics = raw.data || raw || [];
        } else {
          console.error('Failed to fetch key metrics, status:', res.status);
        }
      } catch (err) {
        console.error('Error fetching key metrics:', err);
      }

      setAnalyticsData({
        keyMetrics,
        // Growth analytics and business health are not wired yet; provide safe placeholders
        growthAnalytics: null,
        businessHealth: null,
      });

      // Calculate commission analytics
      const commissionBreakdown = await calculateCommissionAnalytics(members.filter((m: Member) => !m.isAdmin));
      setCommissionAnalytics(commissionBreakdown);

    } catch (error: any) {
      console.error('Failed to load advanced analytics:', error);
      // Don't show toast for Firebase config errors - they're expected in development
      if (!error?.message?.includes('FIREBASE_SERVICE_ACCOUNT_JSON') && !error?.message?.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
        toast({ variant: 'destructive', title: 'Analytics Error', description: 'Could not load advanced analytics data.' });
      }
    } finally {
      setLoadingAnalytics(false);
    }
  }, [members, toast]);

  // Calculate detailed commission analytics
  const calculateCommissionAnalytics = async (memberList: Member[]) => {
    // For now, return empty analytics since commissions aren't available in context
    // This prevents the 500 errors while maintaining the UI structure
    return {
      commissionByType: {},
      avgCommissionPerMember: 0,
      topEarners: [],
      totalCommissions: 0,
      commissionCount: 0,
    };
  };

  // Fetch dashboard metrics
  useEffect(() => {
    if (!user) return;
    setDataLoading(true);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setDashboardData({
            commissions: [],
            orders: [],
            metrics: {
              totalEarned: 0,
              ecashBalance: 0,
              totalMembers: 0,
              totalOrders: 0,
            },
          });
          return;
        }

        const response = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setDashboardData({
              commissions: [],
              orders: [],
              metrics: {
                totalEarned: 0,
                ecashBalance: 0,
                totalMembers: 0,
                totalOrders: 0,
              },
            });
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          setDashboardData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setDashboardData({
          commissions: [],
          orders: [],
          metrics: {
            totalEarned: 0,
            ecashBalance: 0,
            totalMembers: 0,
            totalOrders: 0
          }
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    loadBusinessData();
    loadAdvancedAnalytics();
  }, [loadBusinessData, loadAdvancedAnalytics]);

  const handleCompressTree = async () => {
    setIsCompressing(true);
    try {
      const result = await compressTree();
      if (result.errors > 0) {
        toast({
          variant: 'destructive',
          title: 'Compression Incomplete',
          description: `An error occurred. ${result.compressedCount} members were compressed, but ${result.errors} could not be.`,
        });
      } else {
        toast({
          title: 'Tree Compression Complete',
          description: `${result.compressedCount} inactive members have been compressed.`,
        });
      }
      // Data will refresh via context listener
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Compression Failed',
        description: 'An unexpected error occurred during tree compression.',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  if (context?.loading || loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  const totalEarned = dashboardData?.metrics.totalEarned || 0;
  const ecashBalance = dashboardData?.metrics.ecashBalance || 0;
  const totalMembers = dashboardData?.metrics.totalMembers || 0;
  const recentOrders = dashboardData?.orders.slice(0, 5) || [];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('nav.adminDashboard')}</h1>
          <p className="text-muted-foreground">{t('admin.bi.description')}</p>
        </div>
        <Button onClick={() => { loadBusinessData(); loadAdvancedAnalytics(); }} variant="outline" icon={RefreshCw}>
          {t('admin.bi.refresh')}
        </Button>
      </div>

      {/* System Health Bar */}
      <SystemHealthBar />

      {/* Detailed Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('dashboard.title')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics.advancedAnalytics')}</TabsTrigger>
          <TabsTrigger value="disputes" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {t('analytics.commissionDisputes')}</TabsTrigger>
          <TabsTrigger value="members">{t('admin.bi.tabMember')}</TabsTrigger>
          <TabsTrigger value="financial">{t('admin.bi.tabFinancial')}</TabsTrigger>
          <TabsTrigger value="compliance">{t('admin.bi.tabCompliance')}</TabsTrigger>
          <TabsTrigger value="alerts">{t('admin.bi.tabAlerts')}</TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Personal Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.totalCommissionEarned')}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalEarned)}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.lifetimeEarnings')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.ecashBalance')}</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(ecashBalance)}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.fundsAvailable')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.totalTeamMembers')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMembers}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.everyoneInOrganization')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.totalOrders')}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.metrics.totalOrders ?? dashboardData?.orders.length ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.totalOrdersPlaced')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System-wide Metrics */}
          <KeyMetricsCards members={members} agreements={agreements} />

          {/* Onboarding and Recent Orders */}
          <div className="grid gap-6 md:grid-cols-2">
            <OnboardingProgress />
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recentOrderHistory')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('orders.description')}</p>
              </CardHeader>
              <CardContent>
                {recentOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('dashboard.orderId')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('dashboard.date')}</TableHead>
                        <TableHead>{t('dashboard.status')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.amount')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell className="font-medium">{order.orderId}</TableCell>
                          <TableCell className="hidden sm:table-cell">{new Date(order.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge className={cn('capitalize', getOrderStatusBadge(order.status))}>{t(`orders.${order.status.toLowerCase()}`)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(order.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="h-full text-center flex flex-col items-center justify-center space-y-2 p-6">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('dashboard.noOrdersFound')}</p>
                    <Button asChild variant="outline" icon="add">
                      <Link href="/product">{t('dashboard.placeOrder')}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <MemberManagementTab />
          <BulkUserManagement />
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <FinancialControlsTab financialControls={financialControls} />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <ComplianceTab complianceDocs={complianceDocs} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <EnhancedReportingDashboard />

          {/* Legacy Analytics Components */}
          <AdvancedAnalyticsTab
            loadingAnalytics={loadingAnalytics}
            analyticsData={analyticsData}
            commissionAnalytics={commissionAnalytics}
            members={members}
            onLoadAnalytics={loadAdvancedAnalytics}
          />

          {/* Virtualized Components for Large Datasets */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <VirtualGenealogyTree />
            <VirtualizedReport
              reportType="commission"
              title="Commission Report"
            />
          </div>

          <VirtualizedReport
            reportType="member-activity"
            title="Member Activity Report"
          />
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          <CommissionDisputes isAdmin={true} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <SystemAlertsTab
            members={members}
            financialControls={financialControls}
            agreements={agreements}
            isCompressing={isCompressing}
            onCompressTree={handleCompressTree}
          />
          <RealTimeNotifications />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SessionManagementTab />
          <SecurityAuditDashboard />
          <IncidentResponseTab />
          {user?.accountType === 'SuperAdmin' && <TenantPerformanceDashboard />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
