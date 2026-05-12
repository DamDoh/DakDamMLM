'use client';

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Package, Loader2, ShoppingCart, Wallet, Bell, TrendingUp, Star, UserPlus } from "lucide-react";
import type { Order, Commission } from "@/lib/types";
import { useI18n } from "@/lib/internationalization";
import { formatCurrency } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrderStatusBadge } from "@/lib/status-utils";
import { cn } from "@/lib/utils";
import { useGenealogyContext } from "@/context/genealogy-context";
import OnboardingProgress from "@/components/onboarding/onboarding-progress";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


export default function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { loading: genealogyLoading } = useGenealogyContext() || { loading: true };

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
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.warn('Dashboard: No auth token found, using fallback data');
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
          // Handle 401/403 gracefully without throwing hard errors
          if (response.status === 401 || response.status === 403) {
            const body = await response.json().catch(() => ({}));
            console.warn('Dashboard: Unauthorized access to /api/dashboard', {
              status: response.status,
              body,
            });
            // Use safe fallback data
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
        } else {
          throw new Error(result.error || 'Failed to fetch dashboard data');
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Set default values on error
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


  if (genealogyLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  const totalEarned = dashboardData?.metrics.totalEarned || 0;
  const ecashBalance = dashboardData?.metrics.ecashBalance || 0;
  const totalMembers = dashboardData?.metrics.totalMembers || 0;
  const recentOrders = dashboardData?.orders.slice(0, 5) || [];

  // Sample data for charts
  const networkData = [
    { name: 'Direct', value: 5 },
    { name: 'Level 1', value: 12 },
    { name: 'Level 2', value: 8 },
    { name: 'Level 3', value: 15 },
  ];

  const commissionData = [
    { month: 'Jan', amount: 1200 },
    { month: 'Feb', amount: 1800 },
    { month: 'Mar', amount: 2400 },
    { month: 'Apr', amount: 2100 },
    { month: 'May', amount: 2800 },
    { month: 'Jun', amount: 3200 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  // Determine if user is new (low activity indicators)
  const isNewUser = totalMembers < 5 && totalEarned < 100;

  return (
    <div className="flex-1 space-y-8 p-4 pt-6 sm:p-6 md:p-8">
      {/* Top Bar with Notification Bell */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setNotificationCenterOpen(true)}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          <span className="sr-only">{t('dashboard.notificationsSrOnly')}</span>
          {/* Mock notification badge - in real app this would be dynamic */}
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            3
          </Badge>
        </Button>
      </div>

      {/* Hero Section with Primary Actions */}
      <HeroSection
        totalEarned={totalEarned}
        ecashBalance={ecashBalance}
        totalMembers={totalMembers}
        isNewUser={isNewUser}
      />

      {/* Personalized Product Recommendations */}
      <ProductRecommendations userId={user?.id} limit={6} />

      {/* Quick Stats - Secondary Priority */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.totalCommissionEarned')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEarned)}</div>
              <div className="flex items-center gap-2 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <p className="text-xs text-green-600">{t('dashboard.growthPercentage', { percentage: '12.5' })}</p>
              </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.ecashBalance')}</CardTitle>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(ecashBalance)}</div>
              <div className="flex items-center gap-2 mt-1">
                <Star className="h-3 w-3 text-blue-500" />
                <p className="text-xs text-blue-600">{t('dashboard.readyToSpend')}</p>
              </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.totalTeamMembers')}</CardTitle>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalMembers}</div>
              <div className="flex items-center gap-2 mt-1">
                <UserPlus className="h-3 w-3 text-purple-500" />
                <p className="text-xs text-purple-600">{t('dashboard.newMembersThisWeek', { count: '3' })}</p>
              </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.totalOrders')}</CardTitle>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{dashboardData?.metrics.totalOrders ?? dashboardData?.orders.length ?? 0}</div>
              <div className="flex items-center gap-2 mt-1">
                <ShoppingCart className="h-3 w-3 text-orange-500" />
                <p className="text-xs text-orange-600">{t('dashboard.conversionRate', { percentage: '8.3' })}</p>
              </div>
            </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commission Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commissionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Commission']} />
                <Bar dataKey="amount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={networkData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {networkData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
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

      {/* Notification Center */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </div>
  );
}
