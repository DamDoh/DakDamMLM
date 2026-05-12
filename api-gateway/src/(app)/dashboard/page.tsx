'use client';

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Wallet, Package, Loader2, ShoppingCart } from "lucide-react";
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

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          throw new Error('No auth token found');
        }

        const response = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
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

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
      <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="text-2xl font-bold">{formatCurrency(totalEarned)}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.lifetimeEarnings')}
            </p>
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
            <div className="text-2xl font-bold">{formatCurrency(ecashBalance)}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.fundsAvailable')}
            </p>
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
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.everyoneInOrganization')}
            </p>
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
            <div className="text-2xl font-bold">{dashboardData?.metrics.totalOrders ?? dashboardData?.orders.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.totalOrdersPlaced')}
            </p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
