'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

export default function EcashWithdrawalRequests() {
  const [requests, setRequests] = useState<EcashWithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EcashWithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuthContext();

  useEffect(() => {
    fetchWithdrawalRequests();
  }, []);

  const fetchWithdrawalRequests = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setRequests([]);
        return;
      }

      const response = await fetch('/api/ecash-withdrawal-requests?status=pending', {
        headers: {
          Authorization: `Bearer ${token}`,
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
      }
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const openActionDialog = (request: EcashWithdrawalRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setRejectionReason('');
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
        toast({ title: 'Approved', description: 'Withdrawal request has been approved successfully' });
        fetchWithdrawalRequests();
        setSelectedRequest(null);
        setActionType(null);
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Failed', 
          description: data.error || 'Failed to approve withdrawal request' 
        });
      }
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to approve withdrawal request' 
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
        title: 'Required', 
        description: 'Please provide a reason for rejection' 
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
        toast({ title: 'Rejected', description: 'Withdrawal request has been rejected' });
        fetchWithdrawalRequests();
        setSelectedRequest(null);
        setActionType(null);
        setRejectionReason('');
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Failed', 
          description: data.error || 'Failed to reject withdrawal request' 
        });
      }
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to reject withdrawal request' 
      });
    } finally {
      setProcessing(null);
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
    <>
      <Card>
        <CardHeader>
           <CardTitle className="flex items-center gap-2">
               <DollarSign /> Withdrawal Requests
           </CardTitle>
           <CardDescription>
               Review and approve or reject withdrawal requests from users
           </CardDescription>
         </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground">No pending withdrawal requests</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {requests.map((request) => (
                <AccordionItem value={request.id} key={request.id}>
                   <AccordionTrigger>
                     <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <div>
                              <span className="font-medium">{request.memberName}</span>
                              <Badge variant="secondary" className="ml-2">{formatCurrency(request.amount)}</Badge>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{format(new Date(request.createdDate), 'PP')}</span>
                     </div>
                   </AccordionTrigger>
                   <AccordionContent>
                      <div className="p-4 bg-muted/50 rounded-b-lg space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">Bank Name</p>
                            <p className="text-sm text-muted-foreground">{request.bankName || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Account Holder</p>
                            <p className="text-sm text-muted-foreground">{request.accountName || 'N/A'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium">Bank Account Number</p>
                            <p className="text-sm text-muted-foreground font-mono">{request.bankAccount || 'N/A'}</p>
                          </div>
                          {request.member && (
                            <>
                              <div>
                                <p className="text-sm font-medium">Member ID</p>
                                <p className="text-sm text-muted-foreground">{request.member.memberId}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-sm text-muted-foreground">{request.member.email}</p>
                              </div>
                            </>
                          )}
                        </div>
                        {request.remark && (
                            <div>
                               <p className="text-sm font-medium">Remark</p>
                               <p className="text-sm text-muted-foreground">{request.remark}</p>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-red-600 hover:bg-red-50 hover:text-red-700" 
                            onClick={() => openActionDialog(request, 'reject')} 
                            disabled={processing === request.id}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => openActionDialog(request, 'approve')} 
                            disabled={processing === request.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      </div>
                   </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={!!selectedRequest && actionType === 'approve'} onOpenChange={(open) => !open && (setSelectedRequest(null), setActionType(null))}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Approve Withdrawal Request</DialogTitle>
             <DialogDescription>
               Approve the withdrawal request from {selectedRequest?.memberName} for {formatCurrency(selectedRequest?.amount || 0)}?
               This will debit their E-Cash balance immediately.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="ghost" onClick={() => (setSelectedRequest(null), setActionType(null))}>Cancel</Button>
             <Button onClick={handleApprove} disabled={processing === selectedRequest?.id}>
               {processing === selectedRequest?.id ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Processing...
                 </>
               ) : (
                 'Confirm Approval'
               )}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       <Dialog open={!!selectedRequest && actionType === 'reject'} onOpenChange={(open) => !open && (setSelectedRequest(null), setActionType(null), setRejectionReason(''))}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Reject Withdrawal Request</DialogTitle>
             <DialogDescription>
               Reject the withdrawal request from {selectedRequest?.memberName} for {formatCurrency(selectedRequest?.amount || 0)}?
               Please provide a reason for rejection.
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
               <div>
                   <label htmlFor="rejection-reason" className="text-sm font-medium">Rejection Reason *</label>
                   <Textarea
                       id="rejection-reason"
                       value={rejectionReason}
                       onChange={(e) => setRejectionReason(e.target.value)}
                       placeholder="Enter the reason for rejection..."
                       className="mt-2"
                   />
               </div>
           </div>
           <DialogFooter>
             <Button variant="ghost" onClick={() => (setSelectedRequest(null), setActionType(null), setRejectionReason(''))}>Cancel</Button>
             <Button 
               variant="destructive" 
               onClick={handleReject} 
               disabled={processing === selectedRequest?.id || !rejectionReason.trim()}
             >
               {processing === selectedRequest?.id ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Processing...
                 </>
               ) : (
                 'Confirm Rejection'
               )}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </>
  );
}

