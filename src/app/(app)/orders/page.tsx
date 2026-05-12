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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';


const getColumns = (
  t: (key: string) => string, 
  onViewDetails: (order: Order) => void, 
  toast: (props: { title?: string; description?: string; variant?: 'default' | 'destructive' }) => void
): ColumnDef<Order>[] => [
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
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await navigator.clipboard.writeText(order.orderId);
                  toast({
                    title: t('orders.copySuccess') || 'Copied!',
                    description: t('orders.orderIdCopied') || `Order ID copied to clipboard`,
                  });
                } catch (err) {
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea');
                  textArea.value = order.orderId;
                  textArea.style.position = 'fixed';
                  textArea.style.left = '-999999px';
                  document.body.appendChild(textArea);
                  textArea.select();
                  try {
                    document.execCommand('copy');
                    toast({
                      title: t('orders.copySuccess') || 'Copied!',
                      description: t('orders.orderIdCopied') || `Order ID copied to clipboard`,
                    });
                  } catch (fallbackErr) {
                    toast({
                      variant: 'destructive',
                      title: t('common.error') || 'Error',
                      description: t('orders.copyFailed') || 'Failed to copy order ID',
                    });
                  }
                  document.body.removeChild(textArea);
                }
              }}
              className="flex items-center gap-2"
            >
              <ClipboardCopy className="h-4 w-4" />
              {t('orders.copyOrderId')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                onViewDetails(order);
              }}
              className="flex items-center gap-2"
            >
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
  const { toast } = useToast();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDetails, setOrderDetails] = React.useState<any>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchOrders = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

        if (!token) {
          console.warn('Orders: No auth token found, using empty order list');
          setOrders([]);
          setLoading(false);
          return;
        }

      const response = await fetch('/api/orders?limit=100&offset=0', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const raw = await response.json();
        const data = raw?.data ?? raw ?? [];

        // API returns orders with nested items; transform to Order[]
        const transformedOrders: Order[] = (Array.isArray(data) ? data : []).map((order: any) => ({
          orderId: order.id || order.orderId,
          userId: order.userId,
          date: order.createdAt || order.date,
          amount: order.totalAmount || order.amount,
          status: order.status as 'Fulfilled' | 'Pending' | 'Declined',
          itemCount: Array.isArray(order.items) ? order.items.length : 0,
          items: order.items || [],
        }));

        setOrders(transformedOrders);
        } else {
          const errorText = await response.text().catch(() => '');
          console.error('Orders: Failed to fetch orders:', errorText);
          setOrders([]);
        }
      } catch (error) {
        console.error('Orders: Failed to fetch orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingDetails(true);
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        console.error('No auth token found');
        setOrderDetails(order);
        setLoadingDetails(false);
        return;
      }

      // Fetch full order details - use the new single order endpoint
      const response = await fetch(`/api/orders/${order.orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const raw = await response.json();
        const orderData = raw?.data ?? raw;
        
        if (orderData) {
          // Transform to include all needed fields
          setOrderDetails({
            ...orderData,
            orderId: orderData.id || orderData.orderId,
            createdAt: orderData.createdAt || orderData.date,
            totalAmount: orderData.totalAmount || orderData.amount,
            items: orderData.items || [],
          });
        } else {
          // Use the order data we already have
          setOrderDetails(order);
        }
      } else {
        // If fetch fails, use the order data we already have
        setOrderDetails(order);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      // Use the order data we already have
      setOrderDetails(order);
    } finally {
      setLoadingDetails(false);
    }
  };

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
          <OrdersClient initialData={orders} columns={getColumns(t, handleViewDetails, toast)} />
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('orders.orderDetails')}</DialogTitle>
            <DialogDescription>
              {t('orders.orderIdLabel')}: {selectedOrder?.orderId}
            </DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6 py-4">
              {/* Order Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('orders.orderDate')}</label>
                  <div className="text-base font-medium">
                    {orderDetails.createdAt 
                      ? format(new Date(orderDetails.createdAt), 'PPp')
                      : orderDetails.date
                      ? format(new Date(orderDetails.date), 'PPp')
                      : '-'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('orders.status')}</label>
                  <div>
                    <Badge className={cn('capitalize', getOrderStatusBadge(orderDetails.status))}>
                      {t(`orders.${(orderDetails.status as string).toLowerCase()}`)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('orders.items')}</label>
                  <div className="text-base font-medium">{orderDetails.items?.length || orderDetails.itemCount || 0}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('orders.amount')}</label>
                  <div className="text-lg font-bold">
                    {formatCurrency(orderDetails.totalAmount || orderDetails.amount || 0)}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{t('orders.orderItems')}</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[50%]">{t('orders.product')}</TableHead>
                        <TableHead className="text-center">{t('orders.quantity')}</TableHead>
                        <TableHead className="text-right">{t('orders.unitPrice')}</TableHead>
                        <TableHead className="text-right">{t('orders.total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails.items && orderDetails.items.length > 0 ? (
                        orderDetails.items.map((item: any, index: number) => {
                          const productName = item.product?.name || item.productName || 'Product';
                          const productImage = item.product?.imageUrl;
                          const unitPrice = item.unitPrice || item.price || 0;
                          const quantity = item.quantity || 1;
                          const itemTotal = unitPrice * quantity;
                          
                          return (
                            <TableRow key={item.id || index} className="hover:bg-muted/30">
                              <TableCell>
                                <div className="flex items-center gap-4">
                                  <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border bg-muted">
                                    {productImage ? (
                                      <Image
                                        src={productImage}
                                        alt={productName}
                                        fill
                                        className="object-cover"
                                        unoptimized={productImage?.startsWith('http://') || productImage?.startsWith('https://')}
                                        onError={(e) => {
                                          // Fallback to placeholder if image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-muted">
                                        <Package className="h-8 w-8 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-base mb-1">
                                      {productName}
                                    </div>
                                    {item.product?.description && (
                                      <div className="text-sm text-muted-foreground line-clamp-2">
                                        {item.product.description}
                                      </div>
                                    )}
                                    {item.product?.pv && (
                                      <div className="text-xs text-primary mt-1">
                                        {t('orders.pv')}: {item.product.pv}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="font-medium">{quantity}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="font-medium">{formatCurrency(unitPrice)}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="font-semibold text-base">{formatCurrency(itemTotal)}</div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            {t('orders.noItemsFound')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
