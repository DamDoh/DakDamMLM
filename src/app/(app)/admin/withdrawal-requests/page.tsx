'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, XCircle, Clock, DollarSign, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
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
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';

interface EcashWithdrawalRequest {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  remark?: string;
  status: string;
  bankAccount?: string;
  bankName?: string;
  accountName?: string;
  createdDate: string;
  processedDate?: string;
  rejectionReason?: string;
  member?: {
    id: string;
    firstName: string;
    surname: string;
    memberId: string;
    email: string;
  };
  recipient?: {
    id: string;
    fullName: string;
    memberId: string;
  };
  recipientType?: string;
}

type WithdrawalStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export default function WithdrawalRequestsPage() {
  const searchParams = useSearchParams();
  const requestIdParam = searchParams?.get('requestId');
  const [requests, setRequests] = useState<EcashWithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EcashWithdrawalRequest | null>(null);
  const [viewRequest, setViewRequest] = useState<EcashWithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus>('all');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuthContext();

  useEffect(() => {
    fetchWithdrawalRequests();
  }, [statusFilter]);

  // Handle requestId query parameter - scroll to and highlight the request
  useEffect(() => {
    if (requestIdParam && requests.length > 0 && !loading) {
      const targetRequest = requests.find(r => r.id === requestIdParam);
      if (targetRequest) {
        // Open review dialog
        setSelectedRequest(targetRequest);
        
        // Scroll to the request row after a short delay to ensure DOM is ready
        setTimeout(() => {
          const rowElement = document.getElementById(`request-row-${requestIdParam}`);
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the row temporarily
            rowElement.classList.add('bg-primary/10', 'ring-2', 'ring-primary');
            setTimeout(() => {
              rowElement.classList.remove('bg-primary/10', 'ring-2', 'ring-primary');
            }, 3000);
          }
        }, 300);
      }
    }
  }, [requestIdParam, requests, loading]);

  const fetchWithdrawalRequests = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('ecash.topupRequests.authenticationError'),
          description: t('ecash.topupRequests.pleaseLogIn'),
        });
        setLoading(false);
        return;
      }

      const statusParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await fetch(`/api/ecash-withdrawal-requests${statusParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const raw = await response.json();
        const data = raw?.data ?? raw ?? [];
        setRequests(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Failed to fetch withdrawal requests:', {
          status: response.status,
          error: errorData.error || errorData.message,
        });
        setRequests([]);
        
        if (response.status === 401) {
          toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'Please log in again',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: errorData.message || errorData.error || 'Failed to load withdrawal requests',
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching withdrawal requests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load withdrawal requests',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setProcessing(selectedRequest.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication required' });
        return;
      }

      const response = await fetch('/api/ecash-withdrawal-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: 'approved',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: t('ecash.withdrawalRequests.approvedSuccess'), description: t('ecash.withdrawalRequests.approvedSuccessDesc') });
        setSelectedRequest(null);
        fetchWithdrawalRequests();
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Failed', 
          description: data.error || data.message || 'Failed to approve withdrawal request' 
        });
      }
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error.message || 'Failed to approve withdrawal request' 
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
      if (!rejectionReason.trim()) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.withdrawalRequests.rejectionRequired'), 
        description: t('ecash.withdrawalRequests.rejectionRequiredDesc')
      });
      return;
    }

    setProcessing(selectedRequest.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication required' });
        return;
      }

      const response = await fetch('/api/ecash-withdrawal-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: 'rejected',
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: t('ecash.withdrawalRequests.rejectedSuccess'), description: t('ecash.withdrawalRequests.rejectedSuccessDesc') });
        setSelectedRequest(null);
        setRejectionReason('');
        setShowRejectDialog(false);
        fetchWithdrawalRequests();
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Failed', 
          description: data.error || data.message || 'Failed to reject withdrawal request' 
        });
      }
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error.message || 'Failed to reject withdrawal request' 
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />{t('ecash.topupRequests.pending')}</Badge>;
      case 'approved':
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />{statusLower === 'approved' ? t('ecash.topupRequests.approved') : t('ecash.topupRequests.completed')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t('ecash.topupRequests.rejected')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Format recipient information from remark field into user-friendly text
  const formatRecipientInfo = (request: EcashWithdrawalRequest): string => {
    if (!request.remark) return '-';
    
    // Extract recipient info from remark
    const recipientMatch = request.remark.match(/\[RECIPIENT:(.+?)\]/);
    if (!recipientMatch) {
      // No recipient info, return remark without the technical part
      return request.remark.replace(/\[RECIPIENT:.+?\]/g, '').trim() || '-';
    }
    
    try {
      const recipientInfo = JSON.parse(recipientMatch[1]);
      const recipientType = recipientInfo.recipientType;
      
      // Get recipient type label
      let recipientTypeLabel = '';
      switch (recipientType) {
        case 'admin':
          recipientTypeLabel = t('ecash.withdraw.recipientAdmin') || 'Admin';
          break;
        case 'adminStock':
          recipientTypeLabel = t('ecash.withdraw.recipientAdminStock') || 'Admin Stock';
          break;
        case 'sponsor':
          recipientTypeLabel = t('ecash.withdraw.recipientSponsor') || 'Sponsor';
          break;
        case 'memberDownline':
          recipientTypeLabel = t('ecash.withdraw.recipientMemberDownline') || 'Member Downline';
          break;
        case 'member':
          recipientTypeLabel = t('ecash.withdraw.recipientMember') || 'Member';
          break;
        default:
          recipientTypeLabel = recipientType;
      }
      
      // If recipient info is available, show name
      if (request.recipient?.fullName) {
        return `${t('ecash.withdrawalRequests.transferTo') || 'Transfer to'} ${recipientTypeLabel}: ${request.recipient.fullName} (${request.recipient.memberId})`;
      }
      
      // Otherwise just show the type
      return `${t('ecash.withdrawalRequests.transferTo') || 'Transfer to'} ${recipientTypeLabel}`;
    } catch (e) {
      // If parsing fails, return remark without the technical part
      return request.remark.replace(/\[RECIPIENT:.+?\]/g, '').trim() || '-';
    }
  };

  const pendingRequests = requests.filter(r => r.status.toLowerCase() === 'pending');
  const approvedRequests = requests.filter(r => r.status.toLowerCase() === 'approved' || r.status.toLowerCase() === 'completed');
  const rejectedRequests = requests.filter(r => r.status.toLowerCase() === 'rejected');

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('ecash.withdrawalRequests.title')}</h1>
          <p className="text-muted-foreground">{t('ecash.withdrawalRequests.description')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WithdrawalStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('ecash.topupRequests.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('ecash.topupRequests.allRequests')}</SelectItem>
              <SelectItem value="pending">{t('ecash.topupRequests.pending')}</SelectItem>
              <SelectItem value="approved">{t('ecash.topupRequests.approved')}</SelectItem>
              <SelectItem value="rejected">{t('ecash.topupRequests.rejected')}</SelectItem>
              <SelectItem value="completed">{t('ecash.topupRequests.completed')}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchWithdrawalRequests} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.totalRequests')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.allTimeRequests')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.pending')}</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.awaitingReview')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.approved')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.successfullyProcessed')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.rejected')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedRequests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.rejectedRequests')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ecash.withdrawalRequests.withdrawalRequests')}</CardTitle>
          <CardDescription>
            {statusFilter === 'all' 
              ? t('ecash.topupRequests.showingAll', { count: requests.length.toString() })
              : t('ecash.topupRequests.showingFiltered', { count: requests.length.toString(), status: statusFilter })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium">{t('ecash.topupRequests.noRequestsFound')}</p>
                  <p className="text-sm">
                    {statusFilter === 'all' 
                      ? t('ecash.topupRequests.noRequestsInSystem')
                      : t('ecash.topupRequests.noFilteredRequests', { status: statusFilter })}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ecash.topupRequests.member')}</TableHead>
                    <TableHead>{t('ecash.withdrawalRequests.id')}</TableHead>
                    <TableHead>{t('ecash.amount')}</TableHead>
                    <TableHead>{t('ecash.withdrawalRequests.bankDetails')}</TableHead>
                    <TableHead>{t('ecash.topupRequests.status')}</TableHead>
                    <TableHead>{t('ecash.date')}</TableHead>
                    <TableHead>{t('ecash.topupRequests.remark')}</TableHead>
                    <TableHead className="text-right">{t('ecash.topupRequests.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow 
                      key={request.id}
                      id={`request-row-${request.id}`}
                      className={cn(
                        requestIdParam === request.id ? 'bg-primary/10' : '',
                        (() => {
                          // Check if admin is the recipient
                          if (user?.id && request.remark) {
                            const recipientMatch = request.remark.match(/\[RECIPIENT:(.+?)\]/);
                            if (recipientMatch) {
                              try {
                                const recipientInfo = JSON.parse(recipientMatch[1]);
                                if (recipientInfo.recipientId === user.id) {
                                  return 'bg-blue-50/50 dark:bg-blue-950/20';
                                }
                              } catch (e) {
                                // Invalid JSON
                              }
                            }
                          }
                          return '';
                        })()
                      )}
                    >
                      <TableCell className="font-medium">{request.memberName}</TableCell>
                      <TableCell className="font-mono text-sm">{request.member?.memberId || '-'}</TableCell>
                      <TableCell>{formatCurrency(request.amount)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{request.bankName || 'N/A'}</div>
                          <div className="text-muted-foreground font-mono text-xs">{request.bankAccount || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>{format(new Date(request.createdDate), 'PPp')}</TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={formatRecipientInfo(request)}>
                          {formatRecipientInfo(request)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewRequest(request)}
                            title={t('ecash.topupRequests.viewDetails')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {request.status.toLowerCase() === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setRejectionReason('');
                                  setShowRejectDialog(true);
                                }}
                                disabled={processing === request.id}
                              >
                                {processing === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setRejectionReason('');
                                }}
                                disabled={processing === request.id}
                              >
                                {processing === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('ecash.withdrawalRequests.withdrawalRequestDetails')}</DialogTitle>
            <DialogDescription>
              {t('ecash.withdrawalRequests.viewDetailsFor', { name: viewRequest?.memberName || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.withdrawalRequests.memberName')}</label>
                <div className="text-base font-medium">
                  {viewRequest?.memberName}
                  {viewRequest?.member?.memberId ? ` (${viewRequest.member.memberId})` : ''}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.requestId')}</label>
                <div className="text-base font-mono text-sm">{viewRequest?.id}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.amount')}</label>
                <div className="text-lg font-bold">{formatCurrency(viewRequest?.amount || 0)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.status')}</label>
                <div>{viewRequest ? getStatusBadge(viewRequest.status) : null}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.requestDate')}</label>
                <div className="text-base">
                  {viewRequest?.createdDate 
                    ? format(new Date(viewRequest.createdDate), 'PPp')
                    : '-'}
                </div>
              </div>
              {viewRequest?.processedDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.processedDate')}</label>
                  <div className="text-base">
                    {format(new Date(viewRequest.processedDate), 'PPp')}
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">{t('ecash.withdrawalRequests.bankDetails')}</label>
              <div className="bg-muted p-3 rounded-md space-y-2">
                <div><span className="font-medium">{t('ecash.withdrawalRequests.bank')}</span> {viewRequest?.bankName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountName')}</span> {viewRequest?.accountName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountNumber')}</span> <span className="font-mono">{viewRequest?.bankAccount || 'N/A'}</span></div>
              </div>
            </div>

            {viewRequest?.member && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.withdrawalRequests.memberInformation')}</label>
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <div><span className="font-medium">{t('ecash.withdrawalRequests.memberId')}</span> {viewRequest.member.memberId}</div>
                  <div><span className="font-medium">{t('ecash.withdrawalRequests.email')}</span> {viewRequest.member.email}</div>
                </div>
              </div>
            )}

            {viewRequest?.remark && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.remark')}</label>
                <p className="text-base bg-muted p-3 rounded-md">{formatRecipientInfo(viewRequest)}</p>
              </div>
            )}

            {viewRequest?.rejectionReason && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.withdrawalRequests.rejectionReason')}</label>
                <p className="text-base bg-red-50 border border-red-200 p-3 rounded-md text-red-900">{viewRequest.rejectionReason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewRequest(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval/Review Dialog */}
      <Dialog open={!!selectedRequest && !showRejectDialog} onOpenChange={(open) => {
        if (!open) {
          setSelectedRequest(null);
          setRejectionReason('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('ecash.withdrawalRequests.reviewWithdrawalRequest')}</DialogTitle>
            <DialogDescription>
              {t('ecash.withdrawalRequests.reviewRequestFrom', { name: selectedRequest?.memberName || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.amount')}</label>
                <div className="text-lg font-bold">{formatCurrency(selectedRequest?.amount || 0)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.topupRequests.status')}</label>
                <div>{selectedRequest ? getStatusBadge(selectedRequest.status) : null}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('ecash.withdrawalRequests.bankDetails')}</label>
              <div className="bg-muted p-3 rounded-md space-y-2">
                <div><span className="font-medium">{t('ecash.withdrawalRequests.bank')}</span> {selectedRequest?.bankName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountName')}</span> {selectedRequest?.accountName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountNumber')}</span> <span className="font-mono">{selectedRequest?.bankAccount || 'N/A'}</span></div>
              </div>
            </div>

            {selectedRequest?.member && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.withdrawalRequests.memberInformation')}</label>
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <div><span className="font-medium">{t('ecash.withdrawalRequests.memberId')}</span> {selectedRequest.member.memberId}</div>
                  <div><span className="font-medium">{t('ecash.withdrawalRequests.email')}</span> {selectedRequest.member.email}</div>
                </div>
              </div>
            )}

            {selectedRequest?.remark && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.topupRequests.remark')}</label>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{formatRecipientInfo(selectedRequest)}</p>
              </div>
            )}

          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
              {t('common.cancel')}
            </Button>
            {selectedRequest?.status.toLowerCase() === 'pending' && (
              <>
                <Button 
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setShowRejectDialog(true);
                  }}
                  disabled={processing === selectedRequest?.id}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('ecash.topup.rejectButton')}
                </Button>
                <Button 
                  onClick={handleApprove} 
                  disabled={processing === selectedRequest?.id}
                >
                  {processing === selectedRequest?.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('ecash.topupRequests.processing')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('ecash.topupRequests.approve')}
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog - Separate dialog for rejection */}
      <Dialog open={showRejectDialog && !!selectedRequest} onOpenChange={(open) => {
        if (!open) {
          setShowRejectDialog(false);
          setRejectionReason('');
          if (!processing) {
            setSelectedRequest(null);
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ecash.withdrawalRequests.rejectWithdrawalRequest')}</DialogTitle>
            <DialogDescription>
              {t('ecash.withdrawalRequests.rejectRequestFrom', { name: selectedRequest?.memberName || '', amount: formatCurrency(selectedRequest?.amount || 0) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="rejection-reason" className="text-sm font-medium">
                {t('ecash.withdrawalRequests.rejectionReason')} *
              </label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('ecash.withdrawalRequests.enterRejectionReason')}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setSelectedRequest(null);
              setRejectionReason('');
            }}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processing === selectedRequest?.id || !rejectionReason.trim()}
            >
              {processing === selectedRequest?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('ecash.topupRequests.processing')}
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('ecash.withdrawalRequests.confirmRejection')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
