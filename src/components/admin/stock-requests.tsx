
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, GitBranch, Package, ShoppingCart, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { approveStockRequest, rejectStockRequest } from '@/services/server-actions';
import { useToast } from '@/hooks/use-toast';
import type { StockRequest } from '@/lib/types';
import { stockistLevelNames } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from 'date-fns';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';

interface StockRequestsProps {
  onUpdate: () => void;
}

export default function StockRequests({ onUpdate }: StockRequestsProps) {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const pageSize = 5; // Show 5 requests per page
  const { toast } = useToast();

  // Check if current user is admin or admin stock (S, M, C, D)
  const isAdmin = user?.isAdmin === true;
  const isAdminStock = user?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(user.storeOwnerLevel);
  const canApproveRequests = isAdmin || isAdminStock;

  useEffect(() => {
    fetchStockRequests();
  }, [currentPage]);

  const fetchStockRequests = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        console.warn('No auth token found for stock requests fetch');
        setRequests([]);
        return;
      }

      // Fetch ALL requests (not just pending) to show transaction history with pagination
      const offset = currentPage * pageSize;
      const response = await fetch(`/api/stock-requests?limit=${pageSize}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('API Response:', responseData);

        // Handle both direct array and paginated response format
        // Paginated response: { success: true, data: [...], pagination: {...} }
        // Or direct array: [...]
        const requestsData = Array.isArray(responseData)
          ? responseData
          : (responseData.data || responseData.items || []);

        // Get pagination info if available
        if (responseData.pagination) {
          setTotalCount(responseData.pagination.total || requestsData.length);
          setHasNext(responseData.pagination.hasNext || false);
          setHasPrev(responseData.pagination.hasPrev || false);
        } else {
          // If no pagination info, estimate based on data length
          setTotalCount(requestsData.length);
          setHasNext(requestsData.length >= pageSize);
          setHasPrev(currentPage > 0);
        }

        console.log('Fetched stock requests:', {
          count: requestsData.length,
          page: currentPage,
          total: totalCount,
          data: requestsData,
          rawResponse: responseData
        });

        // Transform the data to match the expected format
        // API returns 'items' in stock request objects, but component expects 'requests'
        const transformedRequests = requestsData.map((req: any) => ({
          ...req,
          requests: req.items || req.requests || [] // Handle both 'items' and 'requests' field names
        }));

        console.log('Transformed requests:', transformedRequests);
        setRequests(transformedRequests);
      } else {
        let errorData: any = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (e) {
            // Response might not be valid JSON
            errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
          }
        } else {
          const text = await response.text().catch(() => '');
          errorData = { message: text || `HTTP ${response.status}: ${response.statusText}` };
        }

        console.error('Failed to fetch stock requests:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        toast({
          variant: 'destructive',
          title: 'Failed to load stock requests',
          description: errorData?.message || `Error ${response.status}: ${response.statusText}`
        });

        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching stock requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await approveStockRequest(requestId);
      toast({ title: t('admin.stock.requestApproved'), description: t('admin.stock.requestApprovedDesc') });
      // Refresh the requests list after approval
      await fetchStockRequests();
      onUpdate();
    } catch (error) {
      console.error('Approval error:', error);
      toast({ variant: 'destructive', title: t('admin.stock.approvalFailed'), description: t('admin.stock.approvalFailedDesc') });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await rejectStockRequest(requestId);
      toast({ title: t('admin.stock.requestRejected') });
      // Refresh the requests list after rejection
      await fetchStockRequests();
      onUpdate();
    } catch (error) {
      console.error('Rejection error:', error);
      toast({ variant: 'destructive', title: t('admin.stock.rejectionFailed'), description: t('admin.stock.rejectionFailedDesc') });
    } finally {
      setProcessing(null);
    }
  };

  const handlePreviousPage = () => {
    if (hasPrev && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" /> {t('admin.stock.requestsTitle')}
          {requests.filter(r => (r.status || '').toLowerCase() === 'pending').length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {requests.filter(r => (r.status || '').toLowerCase() === 'pending').length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {t('admin.stock.requestsDescription')}
          {requests.filter(r => (r.status || '').toLowerCase() === 'pending').length > 0 &&
            ` - ${requests.filter(r => (r.status || '').toLowerCase() === 'pending').length} pending request${requests.filter(r => (r.status || '').toLowerCase() === 'pending').length !== 1 ? 's' : ''}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('admin.stock.noPendingRequests')}</p>
            <p className="text-sm text-muted-foreground mt-2">No stock requests found</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {requests
              .sort((a, b) => {
                // Sort by status: pending first, then by date (newest first)
                const statusOrder: Record<string, number> = { 'pending': 0, 'approved': 1, 'rejected': 2 };
                const aStatus = statusOrder[(a.status || '').toLowerCase()] ?? 3;
                const bStatus = statusOrder[(b.status || '').toLowerCase()] ?? 3;
                if (aStatus !== bStatus) return aStatus - bStatus;
                return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
              })
              .map((request) => {
                const statusLower = (request.status || '').toLowerCase();
                const isPending = statusLower === 'pending';
                const isApproved = statusLower === 'approved';
                const isRejected = statusLower === 'rejected';

                // Extract order ID if it's from an order
                const orderIdMatch = request.stockistName?.match(/^ORDER:([^|]+)/);
                const orderId = orderIdMatch ? orderIdMatch[1] : null;
                const customerName = request.stockistName?.startsWith('ORDER:')
                  ? request.stockistName.split('|')[1] || request.stockistName.replace(/^ORDER:[^|]+\|/, '')
                  : request.stockistName;

                // Calculate total value
                const totalValue = (request as any).totalValue ||
                  (request.requests && request.requests.length > 0
                    ? request.requests.reduce((sum: number, item: any) =>
                      sum + ((item.unitPrice || 0) * (item.requestedQuantity || 0)), 0)
                    : 0);

                return (
                  <AccordionItem value={request.id} key={request.id} className="border rounded-lg mb-2">
                    <AccordionTrigger className="hover:no-underline px-4 py-3">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Status Icon */}
                          <div className={`p-2 rounded-lg ${isPending ? 'bg-yellow-100 text-yellow-600' :
                              isApproved ? 'bg-green-100 text-green-600' :
                                'bg-red-100 text-red-600'
                            }`}>
                            {isPending ? <Clock className="h-4 w-4" /> :
                              isApproved ? <CheckCircle className="h-4 w-4" /> :
                                <XCircle className="h-4 w-4" />}
                          </div>

                          {/* Customer/Order Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-base">{customerName}</span>
                              {orderId && (
                                <Badge variant="outline" className="text-xs">
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  {orderId.substring(0, 12)}...
                                </Badge>
                              )}
                              {!orderId && request.stockistLevel && (
                                <Badge variant="secondary" className="text-xs">
                                  {request.stockistLevel && stockistLevelNames[request.stockistLevel as keyof typeof stockistLevelNames]
                                    ? `${request.stockistLevel} - ${stockistLevelNames[request.stockistLevel as keyof typeof stockistLevelNames]}`
                                    : request.stockistLevel}
                                </Badge>
                              )}
                              {/* Status Badge */}
                              <Badge
                                variant={isPending ? 'default' : isApproved ? 'default' : 'destructive'}
                                className={
                                  isPending ? 'bg-yellow-500' :
                                    isApproved ? 'bg-green-500' :
                                      'bg-red-500'
                                }
                              >
                                {isPending ? 'Pending' : isApproved ? 'Approved' : 'Rejected'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {request.requests?.length || 0} item{(request.requests?.length || 0) !== 1 ? 's' : ''}
                              </span>
                              {totalValue > 0 && (
                                <span className="font-medium text-foreground">
                                  ${totalValue.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">{format(new Date(request.createdDate), 'MMM d, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(request.createdDate), 'h:mm a')}</div>
                            {request.processedDate && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {isApproved ? 'Approved' : 'Rejected'}: {format(new Date(request.processedDate), 'MMM d')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-4 pb-4 pt-2 bg-muted/30 rounded-b-lg border-t">
                        {/* Items List */}
                        <div className="mb-4 mt-2">
                          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Items</h4>
                          <div className="bg-background rounded-lg border p-3 space-y-2">
                            {request.requests && request.requests.length > 0 ? (
                              request.requests.map((item: any, idx: number) => (
                                <div key={item.productId || item.id || idx} className="flex justify-between items-center py-1 border-b last:border-0">
                                  <div className="flex-1">
                                    <span className="font-medium text-sm">{item.productName || 'Unknown Product'}</span>
                                    {item.unitPrice && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ${item.unitPrice.toFixed(2)} each
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-mono font-semibold">
                                      x {item.requestedQuantity || item.approvedQuantity || 0}
                                    </span>
                                    {item.unitPrice && (item.requestedQuantity || item.approvedQuantity || 0) > 0 && (
                                      <span className="text-sm font-semibold min-w-[60px] text-right">
                                        ${((item.unitPrice || 0) * (item.requestedQuantity || item.approvedQuantity || 0)).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground py-2">No items in this request</div>
                            )}
                            {totalValue > 0 && (
                              <div className="flex justify-between items-center pt-2 mt-2 border-t font-semibold">
                                <span>Total</span>
                                <span className="text-lg">${totalValue.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons - Only show for pending requests */}
                        {isPending && (
                          <div className="flex gap-2 justify-end pt-2 border-t">
                            {canApproveRequests ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                  onClick={() => handleReject(request.id)}
                                  disabled={processing === request.id}
                                >
                                  {processing === request.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      {t('common.reject')}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApprove(request.id)}
                                  disabled={processing === request.id}
                                >
                                  {processing === request.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      {t('common.approve')}
                                    </>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground italic">
                                Only admins and stockist members can approve stock requests
                              </div>
                            )}
                          </div>
                        )}

                        {/* Show status info for processed requests */}
                        {(isApproved || isRejected) && request.processedDate && (
                          <div className={`mt-3 pt-3 border-t flex items-center gap-2 text-sm ${isApproved ? 'text-green-700' : 'text-red-700'
                            }`}>
                            {isApproved ? (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                <span>Approved on {format(new Date(request.processedDate), 'MMM d, yyyy h:mm a')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                <span>Rejected on {format(new Date(request.processedDate), 'MMM d, yyyy h:mm a')}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        )}

        {/* Pagination Controls - Show when there are 5+ requests or multiple pages */}
        {totalCount >= pageSize && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(currentPage * pageSize + 1, totalCount)} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} requests
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={!hasPrev || currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground px-3 min-w-[100px] text-center">
                Page {currentPage + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNext}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
