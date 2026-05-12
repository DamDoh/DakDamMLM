'use client';

import * as React from 'react';
import {
  ColumnDef,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import OrdersClient from './orders-client';
import { ArrowUpDown, MoreHorizontal, ClipboardCopy, Eye, Package, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';
import { getOrderStatusBadge } from '@/lib/status-utils';
import { useAuthContext } from '@/context/auth-context';


const getColumns = (t: (key: string) => string): ColumnDef<Order>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'orderId',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('orders.orderId')}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="lowercase pl-4">{row.getValue('orderId')}</div>,
  },
  {
    accessorKey: 'date',
    header: t('orders.date'),
    cell: ({ row }) => <div>{new Date(row.getValue('date')).toLocaleDateString()}</div>,
  },
  {
    accessorKey: 'status',
    header: t('orders.status'),
    cell: ({ row }) => (
       <Badge className={cn('capitalize', getOrderStatusBadge(row.getValue('status')))}>
         {t(`orders.${(row.getValue('status') as string).toLowerCase()}`)}
       </Badge>
     ),
  },
  {
    accessorKey: 'itemCount',
    header: () => <div className="text-right">{t('orders.items')}</div>,
    cell: ({ row }) => <div className="text-right">{row.getValue('itemCount')}</div>
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">{t('orders.amount')}</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const order = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('orders.actions')}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(order.orderId)}
              className="flex items-center gap-2"
            >
              <ClipboardCopy className="h-4 w-4" />
              {t('orders.copyOrderId')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t('orders.viewDetails')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function OrdersPage() {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders');
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        const data = await response.json();
        setOrders(data.data || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (loading) {
    return (
       <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            {t('orders.title')}
          </CardTitle>
          <CardDescription>
            {t('orders.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersClient initialData={orders} columns={getColumns(t)} />
        </CardContent>
      </Card>
    </div>
  );
}
