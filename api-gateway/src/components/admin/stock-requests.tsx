
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, GitBranch } from 'lucide-react';
import { approveStockRequest, rejectStockRequest } from '@/services/server-actions';
import { useToast } from '@/hooks/use-toast';
import type { StockRequest } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from 'date-fns';
import { useI18n } from '@/lib/internationalization';

interface StockRequestsProps {
  onUpdate: () => void;
}

export default function StockRequests({ onUpdate }: StockRequestsProps) {
  const { t } = useI18n();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockRequests();
  }, []);

  const fetchStockRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stock-requests?status=pending');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Failed to fetch stock requests');
      }
    } catch (error) {
      console.error('Error fetching stock requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await approveStockRequest(requestId);
      toast({ title: t('admin.stock.requestApproved'), description: t('admin.stock.requestApprovedDesc') });
      onUpdate();
    } catch (error) {
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
    } catch (error) {
      toast({ variant: 'destructive', title: t('admin.stock.rejectionFailed'), description: t('admin.stock.rejectionFailedDesc') });
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <GitBranch /> {t('admin.stock.requestsTitle')}
        </CardTitle>
        <CardDescription>
            {t('admin.stock.requestsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-muted-foreground">{t('admin.stock.noPendingRequests')}</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {requests.map((request) => (
              <AccordionItem value={request.id} key={request.id}>
                <AccordionTrigger>
                   <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        <div>
                            <span className="font-medium">{request.stockistName}</span>
                            <Badge variant="secondary" className="ml-2">{request.stockistLevel}</Badge>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{format(new Date(request.createdDate), 'PP')}</span>
                   </div>
                </AccordionTrigger>
                <AccordionContent>
                   <div className="p-4 bg-muted/50 rounded-b-lg">
                     <ul className="space-y-1 text-sm mb-4">
                        {request.requests.map(item => (
                            <li key={item.productId} className="flex justify-between">
                                <span>{item.productName}</span>
                                <span className="font-mono">x {item.requestedQuantity}</span>
                            </li>
                        ))}
                     </ul>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleReject(request.id)} disabled={processing === request.id} icon={processing === request.id ? 'loading' : XCircle}>
                        {t('common.reject')}
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(request.id)} disabled={processing === request.id} icon={processing === request.id ? 'loading' : CheckCircle}>
                        {t('common.approveAndTransfer')}
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
  );
}
