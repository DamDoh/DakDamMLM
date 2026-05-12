
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { approveTopUp, rejectTopUp } from '@/services/server-actions';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { EcommTopUpRequest } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from 'date-fns';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/internationalization';

export default function EcommTopUpRequests() {
  const [requests, setRequests] = useState<EcommTopUpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EcommTopUpRequest | null>(null);
  const [adjustedAmount, setAdjustedAmount] = useState<number>(0);

  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    fetchTopupRequests();
  }, []);

  const fetchTopupRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ecash-topup-requests?status=pending');
      if (response.ok) {
        const raw = await response.json();
        const data = raw?.data ?? raw ?? [];
        setRequests(Array.isArray(data) ? data : []);
      } else {
        // Log as a warning but still allow UI to render with no data
        console.warn('Failed to fetch topup requests, status:', response.status);
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching topup requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const openApproveDialog = (request: EcommTopUpRequest) => {
    setSelectedRequest(request);
    setAdjustedAmount(request.amount);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setProcessing(selectedRequest.id);
    try {
      await approveTopUp(selectedRequest.id, selectedRequest.memberId, adjustedAmount);
      toast({ title: t('ecash.topup.approvedTitle'), description: t('ecash.topup.approvedDescription') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('ecash.topup.approvalFailed'), description: t('ecash.topup.approvalFailedDesc') });
    } finally {
      setProcessing(null);
      setSelectedRequest(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await rejectTopUp(requestId);
      toast({ title: t('ecash.topup.rejectedTitle') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('ecash.topup.rejectionFailed'), description: t('ecash.topup.rejectionFailedDesc') });
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
               <DollarSign /> {t('ecash.topup.requestsTitle')}
           </CardTitle>
           <CardDescription>
               {t('ecash.topup.requestsDescription')}
           </CardDescription>
         </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground">{t('ecash.topup.noPendingRequests')}</p>
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
                        {request.remark && (
                            <div>
                               <p className="text-sm font-medium">{t('ecash.topup.remarkLabel')}</p>
                               <p className="text-sm text-muted-foreground">{request.remark}</p>
                            </div>
                        )}
                        {request.proofUrl && (
                            <div>
                                 <p className="text-sm font-medium mb-2">{t('admin.ecash.topup.proofLabel')}</p>
                                 <a href={request.proofUrl} target="_blank" rel="noopener noreferrer">
                                     <Image src={request.proofUrl} alt="Proof of payment" width={200} height={200} className="rounded-md object-contain border" />
                                 </a>
                             </div>
                         )}
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleReject(request.id)} disabled={processing === request.id} icon={processing === request.id ? 'loading' : XCircle}>
                            {t('ecash.topup.rejectButton')}
                          </Button>
                          <Button size="sm" onClick={() => openApproveDialog(request)} disabled={processing === request.id} icon={processing === request.id ? 'loading' : CheckCircle}>
                            {t('ecash.topup.approveButton')}
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
      
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>{t('ecash.topup.approveDialogTitle')}</DialogTitle>
             <DialogDescription>
               {t('ecash.topup.approveDialogDescription', { memberName: selectedRequest?.memberName || '' })}
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
               <div className="text-sm">{t('ecash.topup.requestedAmountLabel')} <span className="font-bold">{formatCurrency(selectedRequest?.amount || 0)}</span></div>
               <div>
                   <label htmlFor="adjusted-amount" className="text-sm font-medium">{t('ecash.topup.approvedAmountLabel')}</label>
                   <Input
                       id="adjusted-amount"
                       type="number"
                       value={adjustedAmount}
                       onChange={(e) => setAdjustedAmount(parseFloat(e.target.value) || 0)}
                   />
               </div>
           </div>
           <DialogFooter>
             <Button variant="ghost" onClick={() => setSelectedRequest(null)}>{t('ecash.topup.cancelButton')}</Button>
             <Button onClick={handleApprove} disabled={processing === selectedRequest?.id} icon={processing === selectedRequest?.id ? "loading" : "confirm"}>
               {t('ecash.topup.confirmApprovalButton')}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </>
  );
}
