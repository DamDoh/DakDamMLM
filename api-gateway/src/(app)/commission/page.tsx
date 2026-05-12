
'use client';

import * as React from 'react';
import {
  DollarSign,
  Wallet,
  Clock,
  Loader2,
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


const getColumns = (t: (key: string) => string): ColumnDef<Commission>[] => [
  {
    accessorKey: 'date',
    header: t('commission.date'),
    cell: ({ row }) => (
      <div>{new Date(row.getValue('date')).toLocaleDateString()}</div>
    ),
  },
  {
    accessorKey: 'type',
    header: t('commission.type'),
    cell: ({ row }) => <div className="capitalize">{row.getValue('type')}</div>,
  },
  {
    accessorKey: 'status',
    header: t('commission.status'),
    cell: ({ row }) => (
      <Badge
        className={cn('capitalize', getCommissionStatusBadge(row.getValue('status')))}
      >
        {t(`commission.${(row.getValue('status') as string).toLowerCase()}`)}
      </Badge>
    ),
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">{t('commission.amount')}</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      return (
        <div className="text-right font-medium">
          {formatCurrency(amount)}
        </div>
      );
    },
  },
];

export default function CommissionPage() {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const [commissions, setCommissions] = React.useState<Commission[]>([]);
  const [loading, setLoading] = React.useState(true);


  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchCommissions = async () => {
      try {
        const response = await fetch(`/api/commissions?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setCommissions(data);
        } else {
          console.error('Failed to fetch commissions:', await response.text());
        }
      } catch (error) {
        console.error('Failed to fetch commissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommissions();
  }, [user]);

  if (loading) {
    return (
       <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    )
  }

  const totalEarned = commissions.reduce((acc, curr) => acc + curr.amount, 0);
  const available = commissions.filter(c => c.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pending = commissions.filter(c => c.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);
  const hasCommissionData = commissions.length > 0;

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
