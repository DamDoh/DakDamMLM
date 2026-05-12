
'use client';

import * as React from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Package, ArrowRightLeft, ArrowUpDown, Boxes, Search, Users as UsersIcon, Clock, CheckCircle, XCircle, Eye, Receipt, FileText, TrendingUp, User, Calendar } from 'lucide-react';
import type { Product, StockItem, Member, StockistLevel } from '@/lib/types';
import { stockistLevelNames, stockistLevels } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useRouter } from 'next/navigation';
import TransferToDownlineDialog from '@/components/stockist/transfer-to-downline-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';
import placeholderData from '@/lib/placeholder-images.json';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  getFilteredRowModel,
} from '@tanstack/react-table';
import { toast } from '../../../../nextjs_original/src/hooks/use-toast';

type ProductWithStock = Product & {
  stock: StockItem;
};

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

// Component to display member's own stock requests
function MyStockRequests({ rootMember, refreshTrigger, onApprovalSuccess }: { rootMember: Member | null; refreshTrigger?: number; onApprovalSuccess?: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 5,
  });

  // Check if user is a stockist (S, M, C, D)
  const hasStockistLevel = rootMember?.storeOwnerLevel &&
    stockistLevels.includes(rootMember.storeOwnerLevel as StockistLevel);

  React.useEffect(() => {
    console.log('🔄 MyStockRequests: useEffect triggered, fetching requests...');
    fetchRequests();
  }, [refreshTrigger]);

  React.useEffect(() => {
    console.log('📊 MyStockRequests: requests state changed:', {
      count: requests.length,
      loading,
      firstRequest: requests[0] ? {
        id: requests[0].id,
        stockistId: requests[0].stockistId,
        status: requests[0].status
      } : null
    });
  }, [requests, loading]);

  // Reset to first page when requests change
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [requests.length]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setRequests([]);
        return;
      }

      // Fetch all requests (not just pending) so members can see their request history
      const response = await fetch('/api/stock-requests', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        console.log('🔍 Raw API Response:', {
          isArray: Array.isArray(data),
          hasSuccess: data?.success,
          hasData: !!data?.data,
          dataType: typeof data,
          keys: Object.keys(data || {}),
          dataLength: Array.isArray(data) ? data.length : (data?.data?.length || 0)
        });

        // Handle paginated response format: { success: true, data: [...], pagination: {...} }
        // Or direct array format: [...]
        let fetchedRequests = [];
        if (Array.isArray(data)) {
          fetchedRequests = data;
          console.log('✅ Parsed as direct array');
        } else if (data && data.data && Array.isArray(data.data)) {
          fetchedRequests = data.data;
          console.log('✅ Parsed as data.data array');
        } else if (data && data.success && data.data && Array.isArray(data.data)) {
          fetchedRequests = data.data;
          console.log('✅ Parsed as success.data array');
        } else {
          console.error('❌ Unknown response format:', data);
        }

        console.log('📦 Stock requests fetched:', {
          total: fetchedRequests.length,
          firstRecord: fetchedRequests[0] ? {
            id: fetchedRequests[0].id,
            stockistId: fetchedRequests[0].stockistId,
            fromUserId: fetchedRequests[0].fromUserId,
            toUserId: fetchedRequests[0].toUserId,
            status: fetchedRequests[0].status,
            itemsCount: fetchedRequests[0].items?.length || 0
          } : null
        });

        setRequests(fetchedRequests);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch stock requests:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        setRequests([]);
      }
    } catch (error) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };


  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: 'Authentication required',
        });
        return;
      }

      const response = await fetch('/api/stock-requests', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          status: 'approved',
        }),
      });

      if (response.ok) {
        toast({
          title: t('admin.stock.requestApproved') || 'Request Approved',
          description: t('admin.stock.requestApprovedDesc') || 'Stock has been transferred from your inventory',
        });
        fetchRequests(); // Refresh the list
        if (onApprovalSuccess) {
          onApprovalSuccess(); // Refresh parent inventory
        }
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: t('admin.stock.approvalFailed') || 'Approval Failed',
          description: errorData.message || t('admin.stock.approvalFailedDesc') || 'Failed to approve stock request',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('admin.stock.approvalFailed') || 'Approval Failed',
        description: error.message || t('admin.stock.approvalFailedDesc') || 'Failed to approve stock request',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: 'Authentication required',
        });
        return;
      }

      const response = await fetch('/api/stock-requests', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          status: 'rejected',
        }),
      });

      if (response.ok) {
        toast({
          title: t('admin.stock.requestRejected'),
          description: 'Stock request has been rejected',
        });
        fetchRequests(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: t('admin.stock.rejectionFailed'),
          description: errorData.message || t('admin.stock.rejectionFailedDesc'),
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('admin.stock.rejectionFailed'),
        description: error.message || t('admin.stock.rejectionFailedDesc'),
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  // Count pending requests for the alert banner
  const pendingRequests = requests.filter((req: any) => req.status === 'PENDING' || req.status === 'pending');
  const pendingCount = pendingRequests.length;

  // Show ALL requests (PENDING, APPROVED, REJECTED) so users can see complete transfer history
  const allRequests = requests;

  // Calculate pagination
  const startIndex = pagination.pageIndex * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedRequests = allRequests.slice(startIndex, endIndex);
  const totalPages = Math.ceil(allRequests.length / pagination.pageSize);
  const canPreviousPage = pagination.pageIndex > 0;
  const canNextPage = pagination.pageIndex < totalPages - 1;

  const handlePreviousPage = () => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.max(0, prev.pageIndex - 1),
    }));
  };

  const handleNextPage = () => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.min(totalPages - 1, prev.pageIndex + 1),
    }));
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground mb-2">{t('admin.stock.noRequests') || 'No Stock Transfers'}</p>
        <p className="text-sm text-muted-foreground">No stock transfer requests or transactions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting your approval
          </span>
        </div>
      )}
      {paginatedRequests.map((request: any) => {
        const requestDate = request.createdDate
          ? new Date(request.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        const status = request.status?.toUpperCase() || 'PENDING';

        const requestId = request.id?.substring(0, 8).toUpperCase() || 'N/A';
        const totalValue = request.totalValue || 0;
        const itemCount = request.itemCount || 0;

        // Calculate total from items if totalValue is not available
        let calculatedTotal = totalValue;
        let totalPV = 0;
        if (calculatedTotal === 0 && request.items && request.items.length > 0) {
          calculatedTotal = request.items.reduce((sum: number, item: any) => {
            const quantity = item.requestedQuantity || item.quantity || 0;
            const price = item.unitPrice || 0;
            return sum + (quantity * price);
          }, 0);
        }

        // Calculate total PV
        if (request.items && request.items.length > 0) {
          totalPV = request.items.reduce((sum: number, item: any) => {
            const quantity = item.requestedQuantity || item.quantity || 0;
            const itemPV = item.pv || 20; // Default PV is 20
            return sum + (quantity * itemPV);
          }, 0);
        }

        // Status-based styling
        const statusConfig = {
          PENDING: {
            gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
            border: 'border-amber-200 dark:border-amber-800',
            badge: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
            icon: Clock,
            iconColor: 'text-amber-600 dark:text-amber-400'
          },
          APPROVED: {
            gradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20',
            border: 'border-emerald-200 dark:border-emerald-800',
            badge: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
            icon: CheckCircle,
            iconColor: 'text-emerald-600 dark:text-emerald-400'
          },
          REJECTED: {
            gradient: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
            border: 'border-red-200 dark:border-red-800',
            badge: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
            icon: XCircle,
            iconColor: 'text-red-600 dark:text-red-400'
          }
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
        const StatusIcon = config.icon;

        // Determine if this is a request the user made (requester) or needs to approve (approver)
        const isRequester = rootMember && request.requesterId === rootMember.id;
        // Use normalized status (uppercased) so it works whether DB stores 'pending' or 'PENDING'
        const isApprover = rootMember && request.stockistId === rootMember.id && status === 'PENDING';

        return (
          <div
            key={request.id}
            className={`
              relative overflow-hidden rounded-lg border ${config.border} 
              bg-gradient-to-br ${config.gradient}
              shadow-xs hover:shadow-md transition-all duration-300
              group
            `}
          >
            {/* Decorative accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient.replace('from-', 'from-').replace('to-', 'to-')}`} />

            <div className="p-4">
              {/* Header Section */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  {/* Status Icon */}
                  <div className={`
                    p-2.5 rounded-md bg-white/60 dark:bg-gray-900/60 
                    backdrop-blur-sm border ${config.border}
                    group-hover:scale-110 transition-transform duration-300
                  `}>
                    <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
                  </div>

                  {/* Request Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold text-base text-foreground truncate">
                        {request.fromUser && request.toUser ? (
                          <span className="flex items-center gap-2">
                            <span>{request.fromUser.fullName || request.fromUser.firstName} {request.fromUser.memberId && `(${request.fromUser.memberId})`}</span>
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>{request.toUser.fullName || request.toUser.firstName} {request.toUser.memberId && `(${request.toUser.memberId})`}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span>{request.stockist?.fullName || request.stockist?.firstName || 'N/A'} {request.stockist?.memberId && `(${request.stockist.memberId})`}</span>
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>
                              {request.requesterName || request.stockistName?.replace(/^Transfer to /i, '') || request.toUser?.fullName || request.toUser?.firstName || request.requester?.fullName || request.requester?.firstName || 'Your Request'}
                              {(request.toUser?.memberId || request.requester?.memberId || request.requesterMemberId) && ` (${request.toUser?.memberId || request.requester?.memberId || request.requesterMemberId})`}
                            </span>
                          </span>
                        )}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {request.stockistLevel && stockistLevelNames[request.stockistLevel as keyof typeof stockistLevelNames] && (
                        <Badge
                          variant="outline"
                          className="bg-white/50 dark:bg-gray-900/50 border-primary/30"
                        >
                          {request.stockistLevel} - {stockistLevelNames[request.stockistLevel as keyof typeof stockistLevelNames]}
                        </Badge>
                      )}

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="font-mono">#{requestId}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end gap-2">
                  <Badge className={`${config.badge} font-semibold px-2.5 py-0.5 text-xs`}>
                    {status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{requestDate}</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-white/40 dark:bg-gray-900/40 rounded-md backdrop- blur-sm border border-white/50 dark:border-gray-800/50">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Package className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">
                      {t('stockist.transfer.totalItems') || 'Items'}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {request.items?.length || 0}
                  </div>
                </div>

                <div className="text-center border-x border-white/50 dark:border-gray-800/50">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">
                      {t('stockist.transfer.totalPV') || 'PV'}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {totalPV}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">
                      {t('businessRules.totalAmount') || 'Total'}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-primary">
                    {formatCurrency(calculatedTotal)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/50 dark:border-gray-800/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRequest(request);
                    setIsDetailsDialogOpen(true);
                  }}
                  className="flex-1 bg-white/60 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900 border-white/50 dark:border-gray-800/50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {t('stockist.transfer.viewInvoiceButton') || 'View Invoice'}
                </Button>

                {/* Approve/Reject buttons for approvers */}
                {isApprover && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 dark:border-red-800 dark:hover:bg-red-950/30"
                      onClick={() => handleReject(request.id)}
                      disabled={processing === request.id}
                    >
                      {processing === request.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      {t('common.reject')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                    >
                      {processing === request.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {t('common.approve')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Pagination Controls */}
      {requests.length > pagination.pageSize && (
        <div className="flex items-center justify-end space-x-2 py-4 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!canPreviousPage}
          >
            {t('common.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!canNextPage}
          >
            {t('common.next')}
          </Button>
        </div>
      )}

      {/* Invoice Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t('stockist.transfer.invoiceTitle') || 'Stock Transfer Request Details'}
            </DialogTitle>
            <DialogDescription>
              {t('stockist.transfer.invoiceDescription') || 'Complete invoice information for this stock transfer request'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (() => {
            const request = selectedRequest;
            const requestId = request.id?.substring(0, 8).toUpperCase() || 'N/A';
            const fullRequestId = request.id || 'N/A';
            const requestDate = request.createdDate
              ? new Date(request.createdDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
              : '';
            const status = request.status?.toUpperCase() || 'PENDING';
            const totalValue = request.totalValue || 0;
            const itemCount = request.itemCount || 0;

            // Calculate total from items if totalValue is not available
            let calculatedTotal = totalValue;
            if (calculatedTotal === 0 && request.items && request.items.length > 0) {
              calculatedTotal = request.items.reduce((sum: number, item: any) => {
                const quantity = item.requestedQuantity || item.quantity || 0;
                const price = item.unitPrice || 0;
                return sum + (quantity * price);
              }, 0);
            }

            return (
              <div className="space-y-6 mt-4">
                {/* Invoice Header */}
                <div className="border-b pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Transfer Details</div>
                      <div className="font-semibold text-lg">
                        {request.fromUser && request.toUser ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">From: {request.fromUser.fullName || request.fromUser.firstName} {request.fromUser.memberId && `(${request.fromUser.memberId})`}</span>
                            <span className="text-sm text-muted-foreground">To: {request.toUser.fullName || request.toUser.firstName} {request.toUser.memberId && `(${request.toUser.memberId})`}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">
                              From: {request.stockist?.fullName || request.stockist?.firstName || 'N/A'} {request.stockist?.memberId && `(${request.stockist.memberId})`}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              To: {request.requesterName || request.stockistName?.replace(/^Transfer to /i, '') || request.toUser?.fullName || request.toUser?.firstName || request.requester?.fullName || request.requester?.firstName || 'N/A'} {(request.toUser?.memberId || request.requester?.memberId || request.requesterMemberId) && `(${request.toUser?.memberId || request.requester?.memberId || request.requesterMemberId})`}
                            </span>
                          </div>
                        )}
                      </div>
                      {request.stockistLevel && stockistLevelNames[request.stockistLevel as keyof typeof stockistLevelNames] && (
                        <Badge variant="secondary" className="mt-2">
                          {request.stockistLevel} - {stockistLevelNames[request.stockistLevel as keyof typeof stockistLevelNames]}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground mb-1">
                        {t('stockist.transfer.requestIdLabel') || 'Request ID'}
                      </div>
                      <div className="font-mono font-semibold mb-2">{requestId}</div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">{fullRequestId}</div>
                      <div className="text-sm text-muted-foreground mb-2">{requestDate}</div>
                      <Badge
                        variant={status === 'PENDING' ? 'default' : status === 'APPROVED' ? 'default' : 'destructive'}
                      >
                        {status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Invoice Items Table */}
                {request.items && request.items.length > 0 && (() => {
                  // Calculate total PV from items
                  const totalPV = request.items.reduce((sum: number, item: any) => {
                    const quantity = item.requestedQuantity || item.quantity || 0;
                    const itemPV = item.pv || 20; // Default PV is 20 if not specified
                    return sum + (quantity * itemPV);
                  }, 0);

                  return (
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        {t('stockist.transfer.itemsLabel') || 'Items'}
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-card">
                        {/* Table Header */}
                        <div className="bg-muted/50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground border-b">
                          <div className="col-span-1">#</div>
                          <div className="col-span-4">{t('stockist.transfer.productColumn') || 'Product'}</div>
                          <div className="col-span-2 text-center">{t('stockist.transfer.qtyColumn') || 'Qty'}</div>
                          <div className="col-span-1 text-right">PV</div>
                          <div className="col-span-2 text-right">{t('stockist.transfer.priceColumn') || 'Price'}</div>
                          <div className="col-span-2 text-right">{t('stockist.transfer.totalColumn') || 'Total'}</div>
                        </div>
                        <div className="divide-y">
                          {request.items.map((item: any, idx: number) => {
                            const quantity = item.requestedQuantity || item.quantity || 0;
                            const unitPrice = item.unitPrice || 0;
                            const itemPV = item.pv || 20;
                            const lineTotal = quantity * unitPrice;
                            const linePV = quantity * itemPV;

                            return (
                              <div key={idx} className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-muted/30 transition-colors">
                                <div className="col-span-1 text-sm text-muted-foreground font-medium">
                                  {idx + 1}
                                </div>
                                <div className="col-span-4">
                                  <div className="font-medium text-sm">{item.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ID: {item.productId?.substring(0, 8) || 'N/A'}
                                  </div>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="inline-flex items-center justify-center bg-primary/10 text-primary font-semibold rounded-md px-3 py-1 text-sm">
                                    {quantity}
                                  </span>
                                </div>
                                <div className="col-span-1 text-right">
                                  <span className="text-sm font-medium text-emerald-600">{linePV}</span>
                                </div>
                                <div className="col-span-2 text-right">
                                  <span className="font-medium text-sm">{formatCurrency(unitPrice)}</span>
                                </div>
                                <div className="col-span-2 text-right">
                                  <span className="font-semibold">{formatCurrency(lineTotal)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Table Footer with Totals */}
                        <div className="bg-muted/30 px-4 py-3 border-t">
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-5 text-sm font-medium text-muted-foreground">
                              {t('stockist.transfer.totalItems', { count: request.items.length.toString() }) || `Total (${request.items.length} item${request.items.length > 1 ? 's' : ''})`}
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="font-semibold">{itemCount || request.items.reduce((sum: number, item: any) => sum + (item.requestedQuantity || item.quantity || 0), 0)}</span>
                            </div>
                            <div className="col-span-1 text-right">
                              <span className="font-semibold text-emerald-600">{totalPV}</span>
                            </div>
                            <div className="col-span-2"></div>
                            <div className="col-span-2 text-right">
                              <span className="font-bold text-lg">{formatCurrency(calculatedTotal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Invoice Summary */}
                <div className="bg-gradient-to-r from-primary/5 to-emerald-500/5 rounded-lg p-4 border">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                          {t('stockist.transfer.totalItems') || 'Total Items'}
                        </div>
                        <div className="text-2xl font-bold">
                          {itemCount || (request.items?.length || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                          {t('stockist.transfer.totalPV') || 'Total PV'}
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">
                          {request.items?.reduce((sum: number, item: any) => {
                            const quantity = item.requestedQuantity || item.quantity || 0;
                            const itemPV = item.pv || 20;
                            return sum + (quantity * itemPV);
                          }, 0) || 0}
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        {t('businessRules.totalAmount') || 'Total Amount'}
                      </div>
                      <div className="text-3xl font-bold text-primary">{formatCurrency(calculatedTotal)}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('cart.subtotal') || 'Subtotal'}: {formatCurrency(calculatedTotal)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {hasStockistLevel &&
                  rootMember &&
                  request.stockistId === rootMember.id &&
                  request.status === 'PENDING' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          handleReject(request.id);
                          setIsDetailsDialogOpen(false);
                        }}
                        disabled={processing === request.id}
                        icon={processing === request.id ? Loader2 : XCircle}
                      >
                        {t('common.reject')}
                      </Button>
                    </div>
                  )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function MyStockPage() {
  const { t, language } = useI18n();
  const context = useGenealogyContext();
  const router = useRouter();

  const { rootMember, loading: contextLoading, allMembersMap, refreshData } = context || { rootMember: null, loading: true, allMembersMap: new Map(), refreshData: async () => { } };

  const [inventory, setInventory] = React.useState<Map<string, StockItem>>(new Map());
  const [products, setProducts] = React.useState<Product[]>([]);
  const [data, setData] = React.useState<ProductWithStock[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const [isTransferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState<Set<string>>(new Set());
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [stockistNetworkFilter, setStockistNetworkFilter] = React.useState('');
  const [inventoryCounts, setInventoryCounts] = React.useState<Record<string, number>>({});
  const [loadingInventory, setLoadingInventory] = React.useState(false);
  const [requestsRefreshTrigger, setRequestsRefreshTrigger] = React.useState(0);

  const isMobile = useIsMobile();

  // Check if user has stockist level (S, M, C, or D) - determines if page shows "Stock Management" or "My Stock"
  const hasStockistLevel = React.useMemo(() => {
    if (!rootMember || contextLoading) return false;
    return rootMember.storeOwnerLevel &&
      stockistLevels.includes(rootMember.storeOwnerLevel as StockistLevel);
  }, [rootMember, contextLoading]);



  const fetchInventory = React.useCallback(async () => {
    if (!rootMember) {
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        return;
      }

      const response = await fetch(`/api/inventory?userId=${rootMember.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch inventory: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      // Handle both direct array and paginated response format
      const inventoryItems = Array.isArray(responseData) ? responseData : (responseData.data || []);

      const newInventory = new Map<string, StockItem>();
      inventoryItems.forEach((item: any) => {
        newInventory.set(item.productId, item);
      });

      setInventory(newInventory);
    } catch (error) {
      // Don't show error toast here as it's not critical
    }
  }, [rootMember]);

  // Fetch all products for the stockist level
  const fetchProducts = React.useCallback(async () => {
    if (!rootMember) {
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        return;
      }

      // Fetch all products with a high limit to get everything
      const response = await fetch('/api/products?limit=1000&isActive=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const responseData = await response.json();
      const fetchedProducts = Array.isArray(responseData) ? responseData : (responseData.data || []);

      setProducts(fetchedProducts);
    } catch (error) {
      // Error handling - silent fail
    }
  }, [rootMember]);

  React.useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, [fetchInventory, fetchProducts]);

  // Function to refresh all data after stock operations
  const refreshAllData = React.useCallback(async () => {
    await fetchInventory();
    await fetchProducts();
    if (refreshData) {
      await refreshData();
    }
  }, [fetchInventory, fetchProducts, refreshData]);

  // Process products and inventory to show all products for stockist level
  React.useEffect(() => {
    if (!contextLoading && rootMember) {
      // Get user's stockist level
      const userStockistLevel = rootMember.storeOwnerLevel;

      // For stockists: Show ALL products from the catalog
      // All products can be assigned to any stockist level, so we show everything
      // The quantity will show 0 if they don't have inventory, or the actual quantity if they do
      let filteredProducts = products;

      // Convert to display format, combining with inventory data
      const stockData: ProductWithStock[] = filteredProducts.map((product) => {
        const inventoryItem = inventory.get(product.id);
        let quantity = 0;

        // Try to get quantity from inventory
        if (inventoryItem) {
          quantity = inventoryItem.quantity || 0;
        } else {
          // If no inventory item found, check if there's a match by checking all inventory items
          // Sometimes product IDs might not match exactly
          const matchingInventory = Array.from(inventory.values()).find((inv: any) =>
            inv.productId === product.id || inv.name === product.name
          );
          if (matchingInventory) {
            quantity = matchingInventory.quantity || 0;
          }
        }

        return {
          ...product,
          stock: {
            productId: product.id,
            productName: product.name,
            quantity: quantity,
            lastUpdated: inventoryItem?.lastUpdated || new Date().toISOString()
          }
        };
      });

      setData(stockData);
      setLoading(false);
    }
  }, [products, inventory, rootMember, contextLoading]);


  React.useEffect(() => {
    if (isMobile) {
      // On mobile, hide price column but keep PV and quantity visible
      setColumnVisibility({ price: false });
    } else {
      // On desktop, show all columns
      setColumnVisibility({});
    }
  }, [isMobile]);

  const handleToggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const handleOpenTransferDialog = () => {
    if (selectedProducts.size === 0) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Please select at least one product to transfer.',
      });
      return;
    }
    setTransferDialogOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === data.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(data.map(p => p.id)));
    }
  };

  // Fetch all members (excluding adminstock) for top-up functionality
  const [allMembersForTopUp, setAllMembersForTopUp] = React.useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);

  React.useEffect(() => {
    const fetchAllMembers = async () => {
      if (!rootMember) {
        setAllMembersForTopUp([]);
        return;
      }

      setLoadingMembers(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (!token) {
          setAllMembersForTopUp([]);
          return;
        }

        // Fetch all members excluding adminstock (members with stockist levels S, M, C, D)
        const allMembers: Member[] = [];
        let offset = 0;
        const limit = 500;
        let hasMore = true;

        while (hasMore) {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const response = await fetch(`/api/members?limit=${limit}&offset=${offset}&withoutStockLevel=true&_t=${timestamp}&_r=${random}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch members');
          }

          const data = await response.json();
          
          if (data.data && Array.isArray(data.data)) {
            allMembers.push(...data.data);
            hasMore = data.pagination?.hasNext || false;
            offset += limit;
          } else if (Array.isArray(data)) {
            allMembers.push(...data);
            hasMore = false;
          } else {
            hasMore = false;
          }
        }

        // Filter out the current user and exclude adminstock (members with stockist levels)
        const filteredMembers = allMembers.filter((m) => {
          return m.id !== rootMember.id && 
                 (!m.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(m.storeOwnerLevel));
        });

        setAllMembersForTopUp(filteredMembers);
      } catch (error) {
        console.error('Failed to fetch all members for top-up:', error);
        setAllMembersForTopUp([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchAllMembers();
  }, [rootMember]);

  const downlineMembers = React.useMemo(() => {
    if (!rootMember) return [];
    // A simple way to get direct downline for now.
    // In a real app, this might be a recursive function or a flattened list.
    const downline: Member[] = [];
    const queue = [rootMember.id];
    const visited = new Set([rootMember.id]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const member = allMembersMap.get(currentId);
      if (member) {
        if (member.children.left && !visited.has(member.children.left)) {
          const child = allMembersMap.get(member.children.left);
          if (child) {
            downline.push(child);
            queue.push(child.id);
            visited.add(child.id);
          }
        }
        if (member.children.right && !visited.has(member.children.right)) {
          const child = allMembersMap.get(member.children.right);
          if (child) {
            downline.push(child);
            queue.push(child.id);
            visited.add(child.id);
          }
        }
      }
    }
    // Filter out members who have stockist levels (S, M, C, D)
    // Only show regular members (no stockist level) for stock transfers
    return downline.filter((m) => {
      return !m.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(m.storeOwnerLevel);
    });
  }, [rootMember, allMembersMap]);

  // Get stockist members from downline (only those with stockist levels)
  const stockistMembers = React.useMemo(() => {
    return downlineMembers.filter(
      (m): m is Member & { storeOwnerLevel: StockistLevel } =>
        m.storeOwnerLevel !== null &&
        m.storeOwnerLevel !== undefined &&
        stockistLevels.includes(m.storeOwnerLevel as StockistLevel)
    );
  }, [downlineMembers]);

  // Fetch inventory counts for stockist network
  React.useEffect(() => {
    const fetchInventoryCounts = async () => {
      if (stockistMembers.length === 0) {
        setInventoryCounts({});
        return;
      }

      setLoadingInventory(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (!token) {
          setInventoryCounts({});
          return;
        }

        const counts: Record<string, number> = {};
        await Promise.all(
          stockistMembers.map(async (member) => {
            try {
              // Use high limit to get all inventory items for accurate count
              const response = await fetch(`/api/inventory?userId=${member.id}&limit=1000`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                const data = await response.json();
                const inventoryItems = Array.isArray(data) ? data : (data?.data ?? []);

                // Sum all quantities from inventory items
                const totalItems = Array.isArray(inventoryItems)
                  ? inventoryItems.reduce((sum: number, item: any) => {
                    const qty = Number(item.quantity) || 0;
                    return sum + qty;
                  }, 0)
                  : 0;

                counts[member.id] = totalItems;
              } else {
                counts[member.id] = 0;
              }
            } catch (error) {
              counts[member.id] = 0;
            }
          })
        );

        setInventoryCounts(counts);
      } catch (error) {
        setInventoryCounts({});
      } finally {
        setLoadingInventory(false);
      }
    };

    if (stockistMembers.length > 0) {
      fetchInventoryCounts();
    }
  }, [stockistMembers]);

  // Stockist network table data
  const stockistNetworkData = React.useMemo(() => {
    return stockistMembers.map(member => ({
      ...member,
      fullName: `${member.firstName || ''} ${member.surname || ''}`.trim(),
      inventoryCount: inventoryCounts[member.id] || 0,
    }));
  }, [stockistMembers, inventoryCounts]);

  // Filter stockist network
  const filteredStockistNetwork = React.useMemo(() => {
    if (!stockistNetworkFilter) return stockistNetworkData;
    const filterLower = stockistNetworkFilter.toLowerCase();
    return stockistNetworkData.filter(stockist =>
      stockist.fullName.toLowerCase().includes(filterLower) ||
      stockist.memberId?.toLowerCase().includes(filterLower) ||
      stockist.location?.toLowerCase().includes(filterLower)
    );
  }, [stockistNetworkData, stockistNetworkFilter]);

  // Stockist Network table columns
  const stockistNetworkColumns: ColumnDef<(typeof stockistNetworkData)[0]>[] = [
    {
      accessorKey: 'fullName',
      header: t('admin.stock.stockist'),
      cell: ({ row }) => {
        const avatarSrc = imageMap.get(row.original.avatarUrl)?.imageUrl || row.original.avatarUrl;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarSrc} alt={row.original.fullName} />
              <AvatarFallback>{row.original.firstName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{row.original.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.original.memberId}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'storeOwnerLevel',
      header: t('admin.stock.level'),
      cell: ({ row }) => {
        const level = row.original.storeOwnerLevel;
        const displayName = level && stockistLevelNames[level as keyof typeof stockistLevelNames]
          ? `${level} - ${stockistLevelNames[level as keyof typeof stockistLevelNames]}`
          : level;
        return <Badge variant="secondary">{displayName}</Badge>;
      },
    },
    {
      accessorKey: 'rank',
      header: t('profile.rank'),
      cell: ({ row }) => <Badge variant="outline">{row.original.rank}</Badge>,
    },
    {
      accessorKey: 'location',
      header: t('admin.stock.location'),
      cell: ({ row }) => row.original.location || <span className="text-muted-foreground">{t('admin.stock.notSet')}</span>,
    },
    {
      accessorKey: 'inventoryCount',
      header: () => <div className="text-right">{t('admin.stock.itemsInStock')}</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {loadingInventory ? (
            <Loader2 className="h-4 w-4 animate-spin inline" />
          ) : (
            row.original.inventoryCount
          )}
        </div>
      ),
    },
  ];

  const stockistNetworkTable = useReactTable({
    data: filteredStockistNetwork,
    columns: stockistNetworkColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter: stockistNetworkFilter,
    },
    onGlobalFilterChange: setStockistNetworkFilter,
  });

  const columns: ColumnDef<ProductWithStock>[] = [
    {
      id: 'select',
      header: () => (
        <Checkbox
          checked={selectedProducts.size === data.length && data.length > 0}
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedProducts.has(row.original.id)}
          onCheckedChange={() => handleToggleProductSelection(row.original.id)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('admin.product.name')}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const imageSrc = imageMap.get(row.original.imageUrl)?.imageUrl || row.original.imageUrl;
        return (
          <div className="flex items-center gap-3">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={row.original.name}
                width={40}
                height={40}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="pl-4 font-medium">{row.getValue('name')}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'price',
      header: () => <div className="text-right">{t('admin.product.price')}</div>,
      cell: ({ row }) => <div className="text-right">{formatCurrency(row.getValue('price'))}</div>,
    },
    {
      accessorKey: 'pv',
      header: () => <div className="text-right">PV</div>,
      cell: ({ row }) => {
        const pv = row.original.pv || 0;
        return <div className="text-right font-medium">{pv.toLocaleString()}</div>;
      },
    },
    {
      accessorKey: 'stock.quantity',
      header: () => <div className="text-right">{t('stockist.myStock.quantity')}</div>,
      cell: ({ row }) => <div className="text-right font-bold text-lg">{row.original.stock.quantity}</div>,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  });

  // Determine page title: "Stock Management" for stockist levels, "My Stock" for others
  const pageTitle = hasStockistLevel ? t('stockist.myStock.title') : t('nav.myStock');

  // Show loading while checking context
  if (contextLoading) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 flex justify-center items-center h-48">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <>
      {rootMember && (
        <>
          <TransferToDownlineDialog
            isOpen={isTransferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            products={data.filter(p => selectedProducts.has(p.id))}
            stockist={rootMember}
            downline={allMembersForTopUp}
            onSuccess={() => {
              refreshAllData();
              setSelectedProducts(new Set());
              setRequestsRefreshTrigger(prev => prev + 1); // Trigger refresh of stock requests
            }}
          />
        </>
      )}
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6">
        {/* For members with stockist levels, show two-section layout like admin */}
        {hasStockistLevel ? (
          <>
            {/* Stock Transfer Requests Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft /> {t('admin.stock.transferHistory') || 'Stock Transfer History'}
                    </CardTitle>
                    <CardDescription>
                      {t('admin.stock.transferHistoryDesc') || 'Review all stock transfer requests and transactions from stockists'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MyStockRequests
                  rootMember={rootMember || null}
                  refreshTrigger={requestsRefreshTrigger}
                  onApprovalSuccess={refreshAllData}
                />
              </CardContent>
            </Card>

            {/* My Inventory Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Boxes /> {t('nav.myStock')}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <CardDescription>
                        {t('stockist.myStock.description')}
                      </CardDescription>
                      {rootMember?.storeOwnerLevel && stockistLevelNames[rootMember.storeOwnerLevel as keyof typeof stockistLevelNames] && (
                        <Badge variant="secondary">
                          {rootMember.storeOwnerLevel} - {stockistLevelNames[rootMember.storeOwnerLevel as keyof typeof stockistLevelNames]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    icon={ArrowRightLeft}
                    onClick={handleOpenTransferDialog}
                    disabled={selectedProducts.size === 0}
                  >
                    {t('stockist.myStock.transfer')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                              <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id}>
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                              >
                                {t('stockist.myStock.noProducts')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        {t('common.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stockist Network Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UsersIcon /> {t('admin.stock.networkTitle')}
                    </CardTitle>
                    <CardDescription>
                      {t('admin.stock.networkDescription')}
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.stock.filterPlaceholder')}
                      value={stockistNetworkFilter}
                      onChange={(e) => setStockistNetworkFilter(e.target.value)}
                      className="pl-8 sm:w-[300px]"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredStockistNetwork.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>{t('admin.stock.noStockists')}</p>
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          {stockistNetworkTable.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {stockistNetworkTable.getRowModel().rows?.length ? (
                            stockistNetworkTable.getRowModel().rows.map((row) => (
                              <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id}>
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={stockistNetworkColumns.length}
                                className="h-24 text-center"
                              >
                                {t('admin.stock.noStockists')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stockistNetworkTable.previousPage()}
                        disabled={!stockistNetworkTable.getCanPreviousPage()}
                      >
                        {t('common.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stockistNetworkTable.nextPage()}
                        disabled={!stockistNetworkTable.getCanNextPage()}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          /* For members without stockist levels, show Stock Transfer Requests and My Stock */
          <>
            {/* Stock Transfer Requests Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft /> {t('admin.stock.transferHistory') || 'Stock Transfer History'}
                    </CardTitle>
                    <CardDescription>
                      {t('admin.stock.transferHistoryDesc') || 'Review all stock transfer requests and transactions from stockists'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MyStockRequests
                  rootMember={rootMember || null}
                  refreshTrigger={requestsRefreshTrigger}
                  onApprovalSuccess={refreshAllData}
                />
              </CardContent>
            </Card>

            {/* My Stock Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package /> {pageTitle}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <CardDescription>
                        {t('stockist.myStock.description')}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                              <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id}>
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                              >
                                {t('stockist.myStock.noProducts')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        {t('common.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
