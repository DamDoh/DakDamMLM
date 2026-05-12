'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, DollarSign, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
}

type WithdrawalStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export default function WithdrawalRequestsPage() {
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

  const fetchWithdrawalRequests = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Please log in again',
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
        
        // Filter to show only requests where current user is the recipient
        const recipientRequests = Array.isArray(data) ? data.filter((req: EcashWithdrawalRequest) => {
          // Skip requests created by the user (they can see those in their own requests)
          if (req.memberId === user?.id) {
            return false;
          }
          
          // Check if user is the recipient by parsing remark field
          if (req.remark) {
            const recipientMatch = req.remark.match(/\[RECIPIENT:(.+?)\]/);
            if (recipientMatch) {
              try {
                const recipientInfo = JSON.parse(recipientMatch[1]);
                return recipientInfo.recipientId === user?.id;
              } catch (e) {
                return false;
              }
            }
          }
          return false;
        }) : [];
        
        setRequests(recipientRequests);
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
          <h1 className="text-3xl font-bold">{t('ecash.withdrawalRequests.title') || 'Withdrawal Requests'}</h1>
          <p className="text-muted-foreground">{t('ecash.withdrawalRequests.description') || 'View and confirm withdrawal requests sent to you'}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchWithdrawalRequests} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.pending') || 'Pending'}</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.awaitingReview') || 'Awaiting your review'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.approved') || 'Approved'}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.successfullyProcessed') || 'Successfully processed'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.rejected') || 'Rejected'}</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedRequests.length}</div>
            <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.rejectedRequests') || 'Rejected requests'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ecash.withdrawalRequests.withdrawalRequests') || 'Withdrawal Requests Sent to You'}</CardTitle>
          <CardDescription>
            {requests.length === 0 
              ? t('ecash.topupRequests.noRequestsFound') || 'No requests found'
              : `${requests.length} request${requests.length !== 1 ? 's' : ''} sent to you`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium">{t('ecash.topupRequests.noRequestsFound') || 'No requests found'}</p>
                  <p className="text-sm">
                    {t('ecash.withdrawalRequests.noRequestsSentToYou') || 'No withdrawal requests have been sent to you yet.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ecash.topupRequests.member') || 'From'}</TableHead>
                    <TableHead>{t('ecash.withdrawalRequests.id')}</TableHead>
                    <TableHead>{t('ecash.amount') || 'Amount'}</TableHead>
                    <TableHead>{t('ecash.withdrawalRequests.bankDetails') || 'Bank Details'}</TableHead>
                    <TableHead>{t('ecash.topupRequests.status') || 'Status'}</TableHead>
                    <TableHead>{t('ecash.date') || 'Date'}</TableHead>
                    <TableHead className="text-right">{t('ecash.topupRequests.actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewRequest(request)}
                            title={t('ecash.topupRequests.viewDetails') || 'View details'}
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
            <DialogTitle>{t('ecash.withdrawalRequests.withdrawalRequestDetails') || 'Withdrawal Request Details'}</DialogTitle>
            <DialogDescription>
              {t('ecash.withdrawalRequests.viewDetailsFor', { name: viewRequest?.memberName || '' }) || `View details for ${viewRequest?.memberName || ''}'s withdrawal request`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.withdrawalRequests.memberName') || 'From'}</label>
                <div className="text-base font-medium">
                  {viewRequest?.memberName}
                  {viewRequest?.member?.memberId ? ` (${viewRequest.member.memberId})` : ''}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.amount') || 'Amount'}</label>
                <div className="text-lg font-bold">{formatCurrency(viewRequest?.amount || 0)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.status') || 'Status'}</label>
                <div>{viewRequest ? getStatusBadge(viewRequest.status) : null}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.requestDate') || 'Request Date'}</label>
                <div className="text-base">
                  {viewRequest?.createdDate 
                    ? format(new Date(viewRequest.createdDate), 'PPp')
                    : '-'}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">{t('ecash.withdrawalRequests.bankDetails') || 'Bank Details'}</label>
              <div className="bg-muted p-3 rounded-md space-y-2">
                <div><span className="font-medium">{t('ecash.withdrawalRequests.bank') || 'Bank'}:</span> {viewRequest?.bankName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountName') || 'Account Name'}:</span> {viewRequest?.accountName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountNumber') || 'Account Number'}:</span> <span className="font-mono">{viewRequest?.bankAccount || 'N/A'}</span></div>
              </div>
            </div>

            {viewRequest?.remark && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.remark') || 'Remark'}</label>
                <p className="text-base bg-muted p-3 rounded-md">{viewRequest.remark.replace(/\[RECIPIENT:.+?\]/g, '').trim() || '-'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewRequest(null)}>
              {t('common.close') || 'Close'}
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
            <DialogTitle>{t('ecash.withdrawalRequests.reviewWithdrawalRequest') || 'Review Withdrawal Request'}</DialogTitle>
            <DialogDescription>
              {t('ecash.withdrawalRequests.reviewRequestFrom', { name: selectedRequest?.memberName || '' }) || `Review the withdrawal request from ${selectedRequest?.memberName || ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.amount') || 'Amount'}</label>
                <div className="text-lg font-bold">{formatCurrency(selectedRequest?.amount || 0)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.topupRequests.status') || 'Status'}</label>
                <div>{selectedRequest ? getStatusBadge(selectedRequest.status) : null}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('ecash.withdrawalRequests.bankDetails') || 'Bank Details'}</label>
              <div className="bg-muted p-3 rounded-md space-y-2">
                <div><span className="font-medium">{t('ecash.withdrawalRequests.bank') || 'Bank'}:</span> {selectedRequest?.bankName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountName') || 'Account Name'}:</span> {selectedRequest?.accountName || 'N/A'}</div>
                <div><span className="font-medium">{t('ecash.withdrawalRequests.accountNumber') || 'Account Number'}:</span> <span className="font-mono">{selectedRequest?.bankAccount || 'N/A'}</span></div>
              </div>
            </div>

            {selectedRequest?.remark && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.topupRequests.remark') || 'Remark'}</label>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{selectedRequest.remark.replace(/\[RECIPIENT:.+?\]/g, '').trim() || '-'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
              {t('common.cancel') || 'Cancel'}
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
                  {t('ecash.topup.rejectButton') || 'Reject'}
                </Button>
                <Button 
                  onClick={handleApprove} 
                  disabled={processing === selectedRequest?.id}
                >
                  {processing === selectedRequest?.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('ecash.topupRequests.processing') || 'Processing...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('ecash.topupRequests.approve') || 'Approve'}
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
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
            <DialogTitle>{t('ecash.withdrawalRequests.rejectWithdrawalRequest') || 'Reject Withdrawal Request'}</DialogTitle>
            <DialogDescription>
              {t('ecash.withdrawalRequests.rejectRequestFrom', { name: selectedRequest?.memberName || '', amount: formatCurrency(selectedRequest?.amount || 0) }) || `Reject the withdrawal request from ${selectedRequest?.memberName || ''} for ${formatCurrency(selectedRequest?.amount || 0)}? Please provide a reason for rejection.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="rejection-reason" className="text-sm font-medium">
                {t('ecash.withdrawalRequests.rejectionReason') || 'Rejection Reason'} *
              </label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('ecash.withdrawalRequests.enterRejectionReason') || 'Enter the reason for rejection...'}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setSelectedRequest(null);
              setRejectionReason('');
            }}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processing === selectedRequest?.id || !rejectionReason.trim()}
            >
              {processing === selectedRequest?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('ecash.topupRequests.processing') || 'Processing...'}
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('ecash.withdrawalRequests.confirmRejection') || 'Confirm Rejection'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

