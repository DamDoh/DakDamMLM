
'use client';

import * as React from 'react';
import {
  DollarSign,
  Clock,
  Loader2,
  Wallet,
} from 'lucide-react';
import {
  ColumnDef,
} from '@tanstack/react-table';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Commission } from '@/lib/types';
import { cn } from '@/lib/utils';
import CommissionClient from './commission-client';
import CommissionForecast from '@/components/commission-forecast';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';
import { getCommissionStatusBadge } from '@/lib/status-utils';
import { useAuthContext } from '@/context/auth-context';
import CommissionDisputes from '@/components/commission-disputes';
import { useToast } from '@/hooks/use-toast';


const getColumns = (t: (key: string) => string): ColumnDef<Commission>[] => [
  {
    accessorKey: 'date',
    header: t('commission.date'),
    cell: ({ row }) => {
      const dateObj = new Date(row.getValue('date'));
      const date = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const time = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return (
        <div className="font-medium text-sm text-foreground">
          {`${date}, ${time}`}
        </div>
      );
    },
  },
  {
    accessorKey: 'type',
    header: t('commission.type'),
    cell: ({ row }) => {
      const type = row.getValue('type') as string;
      // Preserve proper capitalization for specific types
      const displayType = type === 'Matching Bonus' || type === 'Daily Match' || type === 'Binary Bonus' || type === 'Rank Bonus'
        ? type
        : type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

      // Determine badge styling based on type
      const getTypeBadgeClass = () => {
        if (type.includes('Stockist Bonus')) {
          return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
        }
        if (type.includes('Binary Bonus')) {
          return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800";
        }
        if (type.includes('Matching Bonus') || type.includes('Daily Match')) {
          return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
        }
        return "";
      };

      return (
        <Badge
          variant="secondary"
          className={cn("font-medium text-xs px-2.5 py-1", getTypeBadgeClass())}
        >
          {displayType}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'status',
    header: t('commission.status'),
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return (
        <Badge
          className={cn(
            'capitalize font-medium text-xs px-2.5 py-1',
            getCommissionStatusBadge(row.getValue('status')),
            status === 'Paid' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
            status === 'Pending' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
          )}
        >
          {t(`commission.${status.toLowerCase()}`)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">{t('commission.amount')}</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      return (
        <div className="text-right">
          <span className="text-lg font-bold text-green-600 dark:text-green-500">
            {formatCurrency(amount)}
          </span>
        </div>
      );
    },
  },
];

export default function CommissionPage() {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [commissions, setCommissions] = React.useState<Commission[]>([]);
  const [walletBalance, setWalletBalance] = React.useState<number>(0);
  const [stockistBonus, setStockistBonus] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);


  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchCommissions = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

        if (!token) {
          console.warn('Commissions: No auth token found, using empty commission list');
          setCommissions([]);
          setWalletBalance(0);
          setLoading(false);
          return;
        }

        // Fetch commissions, E-Cash balance, and stockist bonus in parallel
        const [commissionsResponse, eCashResponse, stockistBonusResponse] = await Promise.all([
          fetch(`/api/commissions?userId=${user.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`/api/e-cash`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`/api/stockist-bonus?userId=${user.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        ]);

        if (commissionsResponse.ok) {
          const raw = await commissionsResponse.json();
          // Handle paginated response structure: { success: true, data: [...], pagination: {...} }
          const data = raw?.data ?? raw ?? [];
          const commissionsArray = Array.isArray(data) ? data : [];

          setCommissions(commissionsArray);
        } else {
          const errorText = await commissionsResponse.text().catch(() => '');
          console.error('Failed to fetch commissions:', errorText);

          if (commissionsResponse.status === 401 || commissionsResponse.status === 403) {
            console.warn('Commissions: Unauthorized access', { status: commissionsResponse.status, error: errorText });
            setCommissions([]);

            // If token is invalid/expired, clear it and redirect to login
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.message?.includes('expired') || errorData.message?.includes('Invalid')) {
                console.warn('Token expired or invalid, clearing auth token');
                localStorage.removeItem('auth_token');
                // Redirect to login after a short delay
                setTimeout(() => {
                  window.location.href = '/login';
                }, 2000);
              }
            } catch (e) {
              // If error text is not JSON, still clear token if 401
              if (commissionsResponse.status === 401) {
                localStorage.removeItem('auth_token');
                setTimeout(() => {
                  window.location.href = '/login';
                }, 2000);
              }
            }
          }
        }

        if (eCashResponse.ok) {
          const eCashData = await eCashResponse.json();
          if (eCashData.success && eCashData.data) {
            setWalletBalance(eCashData.data.balance || 0);
          } else if (eCashData.data) {
            // Handle direct data response
            setWalletBalance(eCashData.data.balance || 0);
          }
        } else {
          if (eCashResponse.status === 401 || eCashResponse.status === 403) {
            console.warn('E-Cash: Unauthorized access, token may be expired');
            // Token issue already handled above
          } else {
            console.warn('Failed to fetch E-Cash balance, using 0');
          }
          setWalletBalance(0);
        }

        // Handle stockist bonus response
        if (stockistBonusResponse.ok) {
          const bonusData = await stockistBonusResponse.json();
          if (bonusData.success && bonusData.data) {
            setStockistBonus(bonusData.data.totalBonus || 0);
          }
        } else {
          console.warn('Failed to fetch stockist bonus, using 0');
          setStockistBonus(0);
        }
      } catch (error: any) {
        console.error('Failed to fetch commissions:', error);
        // Show user-friendly error message
        if (error.message?.includes('token') || error.message?.includes('Unauthorized')) {
          toast({
            variant: 'destructive',
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again.',
            duration: 5000,
          });
          // Clear token and redirect after delay
          localStorage.removeItem('auth_token');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCommissions();

    // Refresh commissions every 5 seconds to catch new ones
    const interval = setInterval(fetchCommissions, 5000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    )
  }

  // Calculate total earned, excluding old auto-created "Stockist Bonus" commissions
  // Only count "Stockist Bonus (S)", "Stockist Bonus (M)", etc. from actual stock transfers
  const totalEarned = commissions
    .filter(c => {
      // Reject generic "Stockist Bonus" without level indicator (old auto-created commissions)
      if (c.type === 'Stockist Bonus') {
        return false; // Exclude old auto-created Stockist Bonus
      }
      // Accept "Stockist Bonus (S)", "Stockist Bonus (M)", etc. (from actual stock transfers)
      if (c.type && c.type.includes('Stockist Bonus')) {
        // Only accept if it has level indicator
        return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
      }
      // Accept all other commission types
      return true;
    })
    .reduce((acc, curr) => acc + curr.amount, 0);
  const available = walletBalance; // Use wallet balance for available withdrawal
  const pending = commissions.filter(c => c.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);
  const hasCommissionData = commissions.length > 0;

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('commission.totalEarned')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEarned)}</div>
            <p className="text-xs text-muted-foreground">
              {t('commission.lifetimeEarnings')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('commission.availableForWithdrawal')}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(available)}</div>
            <p className="text-xs text-muted-foreground">
              {t('commission.fundsAvailable')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('ecash.totalStockistBonus') || 'Total Stockist Bonus'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stockistBonus)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('ecash.totalPVFromTransfers') || 'From PV transfers'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('commission.pendingCommission')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pending)}</div>
            <p className="text-xs text-muted-foreground">
              {t('commission.awaitingClearance')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commission Forecast */}
      <CommissionForecast />

      <Card>
        <CardHeader>
          <CardTitle>{t('commission.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionClient initialData={commissions} columns={getColumns(t)} />
        </CardContent>
      </Card>

      <CommissionDisputes hasCommissionData={hasCommissionData} />
    </div>
  );
}
