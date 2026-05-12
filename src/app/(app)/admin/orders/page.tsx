'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Package, CheckCircle, XCircle, Clock, MoreVertical, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { getOrderStatusBadge } from '@/lib/status-utils';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Order } from '@/lib/types';

type OrderStatus = 'Fulfilled' | 'Pending' | 'Declined';

export default function AdminOrdersPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('Pending');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  
  // Status counts for cards
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    fulfilled: 0,
    declined: 0,
  });

  const fetchStatusCounts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Fetch counts for each status
      const [allResponse, pendingResponse, fulfilledResponse, declinedResponse] = await Promise.all([
        fetch('/api/orders?limit=1&offset=0', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch('/api/orders?status=Pending&limit=1&offset=0', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch('/api/orders?status=Fulfilled&limit=1&offset=0', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch('/api/orders?status=Declined&limit=1&offset=0', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      // Check for authentication errors
      if (allResponse.status === 401 || pendingResponse.status === 401 || 
          fulfilledResponse.status === 401 || declinedResponse.status === 401) {
        console.warn('Token expired while fetching status counts');
        localStorage.removeItem('auth_token');
        return;
      }

      const allData = allResponse.ok ? await allResponse.json() : null;
      const pendingData = pendingResponse.ok ? await pendingResponse.json() : null;
      const fulfilledData = fulfilledResponse.ok ? await fulfilledResponse.json() : null;
      const declinedData = declinedResponse.ok ? await declinedResponse.json() : null;

      setStatusCounts({
        all: allData?.pagination?.total || 0,
        pending: pendingData?.pagination?.total || 0,
        fulfilled: fulfilledData?.pagination?.total || 0,
        declined: declinedData?.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  const fetchOrders = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Please log in again.',
        });
        return;
      }

      // Calculate offset based on page
      const offset = page * pageSize;
      
      // Build query params
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      // Add status filter if not 'all'
      // Capitalize first letter to match database format (Pending, Fulfilled, Declined)
      if (statusFilter !== 'all') {
        const capitalizedStatus = statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).toLowerCase();
        params.append('status', capitalizedStatus);
      }

      const response = await fetch(`/api/orders?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch orders:', response.status, errorText);
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message?.includes('expired') || errorData.message?.includes('Invalid') || errorData.message?.includes('token')) {
              console.warn('Token expired or invalid, clearing auth token');
              localStorage.removeItem('auth_token');
              toast({
                variant: 'destructive',
                title: 'Session Expired',
                description: 'Your session has expired. Please log in again.',
              });
              // Redirect to login after a short delay
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
              return;
            }
          } catch (e) {
            // If error text is not JSON, still clear token if 401
            if (response.status === 401) {
              localStorage.removeItem('auth_token');
              toast({
                variant: 'destructive',
                title: 'Authentication Error',
                description: 'Please log in again.',
              });
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
              return;
            }
          }
        }
        
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const result = await response.json();
      console.log('Orders API response:', result);
      
      if (result.success) {
        // Handle paginated response
        let ordersData: Order[] = [];
        if (Array.isArray(result.data)) {
          ordersData = result.data;
        } else if (result.data && Array.isArray(result.data.orders)) {
          ordersData = result.data.orders;
        }
        
        setOrders(ordersData);
        
        // Extract pagination metadata
        if (result.pagination) {
          setTotal(result.pagination.total || 0);
          setHasNext(result.pagination.hasNext || false);
          setHasPrev(result.pagination.hasPrev || false);
        } else {
          // Fallback: calculate from data
          setTotal(ordersData.length);
          setHasNext(ordersData.length === pageSize);
          setHasPrev(page > 0);
        }
      } else {
        console.error('API returned error:', result.error || result.message);
        setOrders([]);
        setTotal(0);
        setHasNext(false);
        setHasPrev(false);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load orders. Please try again.',
      });
      setOrders([]);
      setTotal(0);
      setHasNext(false);
      setHasPrev(false);
    } finally {
      setLoading(false);
    }
  };

  // Fetch status counts independently - they should always show totals regardless of filter
  useEffect(() => {
    fetchStatusCounts();
  }, []);

  useEffect(() => {
    // When filter changes, only refetch orders (not status counts)
    fetchOrders(0); // Reset to first page when status filter changes
    setCurrentPage(0);
    // Don't refetch status counts here - they should always show totals
  }, [statusFilter]);

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchOrders(newPage);
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchOrders(newPage);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Please log in again.',
        });
        return;
      }

      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          const errorText = await response.text().catch(() => '');
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message?.includes('expired') || errorData.message?.includes('Invalid') || errorData.message?.includes('token')) {
              localStorage.removeItem('auth_token');
              toast({
                variant: 'destructive',
                title: 'Session Expired',
                description: 'Your session has expired. Please log in again.',
              });
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
              return;
            }
          } catch (e) {
            if (response.status === 401) {
              localStorage.removeItem('auth_token');
              toast({
                variant: 'destructive',
                title: 'Authentication Error',
                description: 'Please log in again.',
              });
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
              return;
            }
          }
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Failed to update order' }));
        throw new Error(errorData.error || errorData.message || 'Failed to update order status');
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: t('admin.orderStatusUpdated'),
          description: t('admin.orderStatusUpdatedDescription', {
            orderId,
            status,
          }),
        });

        // Refresh current page to get updated data
        fetchOrders(currentPage);
        
        // Refresh status counts to update the cards with latest totals
        await fetchStatusCounts();

        setIsStatusDialogOpen(false);
        setSelectedOrder(null);
      } else {
        throw new Error(result.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast({
        variant: 'destructive',
        title: t('admin.updateFailed'),
        description: error instanceof Error ? error.message : t('admin.updateFailedDescription'),
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status as OrderStatus);
    setIsStatusDialogOpen(true);
  };

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsDialogOpen(true);
    setLoadingDetails(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        setOrderDetails(order);
        setLoadingDetails(false);
        return;
      }

      // Fetch full order details
      const response = await fetch(`/api/orders/${order.orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const raw = await response.json();
        const orderData = raw?.data ?? raw;
        
        if (orderData) {
          setOrderDetails({
            ...orderData,
            orderId: orderData.id || orderData.orderId,
            createdAt: orderData.createdAt || orderData.date,
            totalAmount: orderData.totalAmount || orderData.amount,
            items: orderData.items || [],
          });
        } else {
          setOrderDetails(order);
        }
      } else {
        setOrderDetails(order);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      setOrderDetails(order);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Orders are already filtered by status on the server side
  const filteredOrders = orders;

  const totalPages = Math.ceil(total / pageSize);
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, total);

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.recentSales')}</h1>
          <p className="text-muted-foreground">{t('admin.recentSalesDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('admin.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.filterAll')}</SelectItem>
              <SelectItem value="pending">{t('orders.pending')}</SelectItem>
              <SelectItem value="fulfilled">{t('orders.fulfilled')}</SelectItem>
              <SelectItem value="declined">{t('orders.declined')}</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => {
              fetchOrders(currentPage);
              fetchStatusCounts(); // Also refresh status counts
            }} 
            variant="outline" 
            icon={RefreshCw} 
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.totalOrders')}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.all}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.allOrdersInSystem')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.pendingTitle')}
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.pending}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.ordersWaitingForFulfillment')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.fulfilledTitle')}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.fulfilled}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.ordersSuccessfullyCompleted')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.declinedTitle')}
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.declined}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.ordersThatWereDeclined')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('admin.ordersTitle')}
          </CardTitle>
          <CardDescription>
            {t('admin.recentSalesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('dashboard.noOrdersFound')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.orderId')}</TableHead>
                      <TableHead>{t('dashboard.date')}</TableHead>
                      <TableHead>{t('admin.customer')}</TableHead>
                      <TableHead>{t('admin.status')}</TableHead>
                      <TableHead className="text-right">{t('admin.amount')}</TableHead>
                      <TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.orderId}>
                        <TableCell className="font-medium font-mono text-sm">
                          {order.orderId}
                        </TableCell>
                        <TableCell>
                          {new Date(order.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.userId?.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('capitalize', getOrderStatusBadge(order.status))}>
                            {t(`orders.${order.status.toLowerCase()}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">{t('admin.openMenu')}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t('orders.viewDetails') || 'View Details'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openStatusDialog(order)}>
                                {t('admin.changeStatus')}
                              </DropdownMenuItem>
                              {order.status !== 'Fulfilled' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(order.orderId, 'Fulfilled')}
                                  disabled={updatingOrderId === order.orderId}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  {t('admin.markAsFulfilled')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              {total > pageSize && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {t('admin.showingOrders', { start: String(startItem), end: String(endItem), total: String(total) })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={!hasPrev || currentPage === 0 || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('common.previous')}
                    </Button>
                    <div className="text-sm text-muted-foreground px-3 min-w-[100px] text-center">
                      {t('admin.pageOf', { current: String(currentPage + 1), total: String(totalPages) })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!hasNext || loading}
                    >
                      {t('common.next')}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={(open) => {
        setIsDetailsDialogOpen(open);
        if (!open) {
          setSelectedOrder(null);
          setOrderDetails(null);
        }
      }}>
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

              {/* Customer Info */}
              {orderDetails.user && (
                <div className="space-y-2 border-t pt-4">
                  <label className="text-sm font-medium text-muted-foreground">{t('admin.customer')} {t('common.information')}</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">{t('common.name')}</div>
                      <div className="font-medium">
                        {orderDetails.user.firstName && orderDetails.user.surname
                          ? `${orderDetails.user.firstName} ${orderDetails.user.surname}`
                          : orderDetails.user.memberId || t('common.na')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t('admin.users.memberId')}</div>
                      <div className="font-medium">{orderDetails.user.memberId || t('common.na')}</div>
                    </div>
                    {orderDetails.user.email && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t('common.email')}</div>
                        <div className="font-medium">{orderDetails.user.email}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div className="space-y-4 border-t pt-4">
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

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.changeStatus')}</DialogTitle>
            <DialogDescription>
              {t('admin.orderStatusUpdatedDescription', {
                orderId: selectedOrder?.orderId || '',
                status: selectedOrder?.status || '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.status')}</label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {t('orders.pending')}
                    </div>
                  </SelectItem>
                  <SelectItem value="Fulfilled">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {t('orders.fulfilled')}
                    </div>
                  </SelectItem>
                  <SelectItem value="Declined">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {t('orders.declined')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsStatusDialogOpen(false);
                setSelectedOrder(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (selectedOrder) {
                  handleStatusUpdate(selectedOrder.orderId, newStatus);
                }
              }}
              disabled={updatingOrderId === selectedOrder?.orderId || !selectedOrder}
            >
              {updatingOrderId === selectedOrder?.orderId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.updating')}
                </>
              ) : (
                t('common.update')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

