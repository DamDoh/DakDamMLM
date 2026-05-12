'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, XCircle, Clock, Coins, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPV } from '@/lib/utils';
import type { EcommTopUpRequest, MaintenanceTopupRequest } from '@/lib/types';
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

type TopupStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export default function TopupRequestsPage() {
  const searchParams = useSearchParams();
  const requestIdParam = searchParams?.get('requestId');
  const [activeTab, setActiveTab] = useState<'pv' | 'maintenance'>('pv');
  const [requests, setRequests] = useState<EcommTopUpRequest[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceTopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EcommTopUpRequest | null>(null);
  const [viewRequest, setViewRequest] = useState<EcommTopUpRequest | null>(null);
  const [adjustedAmount, setAdjustedAmount] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<TopupStatus>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    if (activeTab === 'pv') {
      fetchTopupRequests();
    } else {
      fetchMaintenanceTopupRequests();
    }
  }, [statusFilter, activeTab]);

  // Handle requestId query parameter - scroll to and highlight the request
  useEffect(() => {
    if (requestIdParam && requests.length > 0 && !loading) {
      const targetRequest = requests.find(r => r.id === requestIdParam);
      if (targetRequest) {
        // Open view dialog
        setViewRequest(targetRequest);
        
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

  const fetchTopupRequests = async () => {
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
      const response = await fetch(`/api/pv-topup-requests${statusParam}`, {
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
        console.warn('Failed to fetch topup requests:', {
          status: response.status,
          error: errorData.error || errorData.message,
        });
        setRequests([]);
        
        if (response.status === 401) {
      toast({
        variant: 'destructive',
        title: t('ecash.topupRequests.authenticationError'),
        description: t('ecash.topupRequests.pleaseLogIn'),
      });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: errorData.message || errorData.error || 'Failed to load PV points top-up requests',
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching topup requests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load PV points top-up requests',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceTopupRequests = async () => {
    try {
      setMaintenanceLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('ecash.topupRequests.authenticationError'),
          description: t('ecash.topupRequests.pleaseLogIn'),
        });
        setMaintenanceLoading(false);
        return;
      }

      const statusParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await fetch(`/api/maintenance-topup-requests${statusParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const raw = await response.json();
        const data = raw?.data ?? raw ?? [];
        setMaintenanceRequests(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Failed to fetch maintenance topup requests:', {
          status: response.status,
          error: errorData.error || errorData.message,
        });
        setMaintenanceRequests([]);
        
        if (response.status === 401) {
          toast({
            variant: 'destructive',
            title: t('ecash.topupRequests.authenticationError'),
            description: t('ecash.topupRequests.pleaseLogIn'),
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: errorData.message || errorData.error || 'Failed to load maintenance topup requests',
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching maintenance topup requests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load maintenance topup requests',
      });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'pv') {
      fetchTopupRequests();
    } else {
      fetchMaintenanceTopupRequests();
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ 
          variant: 'destructive', 
          title: 'Authentication Error', 
          description: 'Please log in again' 
        });
        setProcessing(null);
        return;
      }

      // If amount is adjusted, first update the amount, then approve
      if (adjustedAmount !== selectedRequest.amount) {
        // Update amount via API (if needed)
        // For now, we'll approve with the adjusted amount
      }

      const response = await fetch('/api/pv-topup-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: 'approved',
          adjustedAmount: adjustedAmount !== selectedRequest.amount ? adjustedAmount : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorData.error || errorData.details || `Server error: ${response.status}`;
        console.error('Approval failed:', {
          status: response.status,
          error: errorMsg,
          errorData
        });
        throw new Error(errorMsg);
      }

      const data = await response.json().catch(() => ({}));
      
      toast({ 
        title: t('ecash.topupRequests.approvedSuccess'), 
        description: data.message || t('ecash.topupRequests.approvedSuccessDesc')
      });
      setSelectedRequest(null);
      fetchTopupRequests();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.topupRequests.approvalFailed'), 
        description: error.message || t('ecash.topupRequests.approvalFailedDesc')
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleMaintenanceApprove = async (request: MaintenanceTopupRequest) => {
    setProcessing(request.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ 
          variant: 'destructive', 
          title: 'Authentication Error', 
          description: 'Please log in again' 
        });
        setProcessing(null);
        return;
      }

      const response = await fetch('/api/maintenance-topup-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: request.id,
          status: 'approved',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorData.error || errorData.details || `Server error: ${response.status}`;
        throw new Error(errorMsg);
      }

      toast({ 
        title: t('ecash.topupRequests.approvedSuccess'), 
        description: 'Maintenance topup request approved successfully'
      });
      fetchMaintenanceTopupRequests();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.topupRequests.approvalFailed'), 
        description: error.message || t('ecash.topupRequests.approvalFailedDesc')
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleMaintenanceReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ 
          variant: 'destructive', 
          title: 'Authentication Error', 
          description: 'Please log in again' 
        });
        setProcessing(null);
        return;
      }

      const response = await fetch('/api/maintenance-topup-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          status: 'rejected',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorData.error || errorData.details || `Server error: ${response.status}`;
        throw new Error(errorMsg);
      }

      toast({ 
        title: t('ecash.topupRequests.rejectedSuccess'), 
        description: 'Maintenance topup request rejected successfully'
      });
      fetchMaintenanceTopupRequests();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.topupRequests.rejectionFailed'), 
        description: error.message || t('ecash.topupRequests.rejectionFailedDesc')
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
          title: 'Authentication Error', 
          description: 'Please log in again' 
        });
        setProcessing(null);
        return;
      }

      const response = await fetch('/api/pv-topup-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          status: 'rejected',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorData.error || errorData.details || `Server error: ${response.status}`;
        console.error('Rejection failed:', {
          status: response.status,
          error: errorMsg,
          errorData
        });
        throw new Error(errorMsg);
      }

      const data = await response.json().catch(() => ({}));
      
      toast({ 
        title: t('ecash.topupRequests.rejectedSuccess'), 
        description: data.message || t('ecash.topupRequests.rejectedSuccessDesc')
      });
      fetchTopupRequests();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.topupRequests.rejectionFailed'), 
        description: error.message || t('ecash.topupRequests.rejectionFailedDesc')
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

  if ((activeTab === 'pv' && loading && requests.length === 0) || (activeTab === 'maintenance' && maintenanceLoading && maintenanceRequests.length === 0)) {
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
          <h1 className="text-3xl font-bold">{t('ecash.topupRequests.title')}</h1>
          <p className="text-muted-foreground">{t('ecash.topupRequests.description')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TopupStatus)}>
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
          <Button onClick={handleRefresh} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs for PV and Maintenance Topup Requests */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pv' | 'maintenance')}>
        <TabsList>
          <TabsTrigger value="pv">PV Topup Requests</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Topup Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="pv" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.totalRequests')}</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
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
                <div className="text-2xl font-bold">{requests.filter(r => r.status === 'pending').length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.awaitingReview')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.approved')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{requests.filter(r => r.status === 'approved').length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.successfullyProcessed')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.rejected')}</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{requests.filter(r => r.status === 'rejected').length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.rejectedRequests')}</p>
              </CardContent>
            </Card>
          </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ecash.topupRequests.topupRequests')}</CardTitle>
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
                    <TableHead>{t('ecash.amount')}</TableHead>
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
                      className={requestIdParam === request.id ? 'bg-primary/10' : ''}
                    >
                      <TableCell className="font-medium">{request.memberName}</TableCell>
                      <TableCell>{formatPV(request.amount)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>{format(new Date(request.createdDate), 'PPp')}</TableCell>
                      <TableCell className="max-w-xs truncate">{request.remark || '-'}</TableCell>
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
                                onClick={() => handleReject(request.id)}
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
                                onClick={() => openApproveDialog(request)}
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
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          {/* Summary Cards for Maintenance */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.totalRequests')}</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maintenanceRequests.length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.allTimeRequests')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.pending')}</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maintenanceRequests.filter(r => r.status === 'pending').length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.awaitingReview')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.approved')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maintenanceRequests.filter(r => r.status === 'approved' || r.status === 'completed').length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.successfullyProcessed')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('ecash.topupRequests.rejected')}</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maintenanceRequests.filter(r => r.status === 'rejected').length}</div>
                <p className="text-xs text-muted-foreground">{t('ecash.topupRequests.rejectedRequests')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Maintenance Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Topup Requests</CardTitle>
              <CardDescription>
                {statusFilter === 'all' 
                  ? `Showing all ${maintenanceRequests.length} requests`
                  : `Showing ${maintenanceRequests.length} ${statusFilter} request(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {maintenanceRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {maintenanceLoading ? (
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
                        <TableHead>Month</TableHead>
                        <TableHead>{t('ecash.amount')}</TableHead>
                        <TableHead>{t('ecash.topupRequests.status')}</TableHead>
                        <TableHead>{t('ecash.date')}</TableHead>
                        <TableHead>{t('ecash.topupRequests.remark')}</TableHead>
                        <TableHead className="text-right">{t('ecash.topupRequests.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.memberName}</TableCell>
                          <TableCell>{request.month}</TableCell>
                          <TableCell>{formatPV(request.amount)}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>{format(new Date(request.createdDate), 'PPp')}</TableCell>
                          <TableCell className="max-w-xs truncate">{request.remark || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewRequest(request as any)}
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
                                    onClick={() => handleMaintenanceReject(request.id)}
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
                                    onClick={() => handleMaintenanceApprove(request)}
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
        </TabsContent>
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('ecash.topupRequests.topupRequestDetails')}</DialogTitle>
            <DialogDescription>
              {t('ecash.topupRequests.viewDetailsFor', { name: viewRequest?.memberName || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.memberName')}</label>
                <div className="text-base font-medium">{viewRequest?.memberName}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.requestId')}</label>
                <div className="text-base font-mono text-sm">{viewRequest?.id}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.amount')}</label>
                <div className="text-lg font-bold">{formatPV(viewRequest?.amount || 0)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.status')}</label>
                <div>{getStatusBadge(viewRequest?.status || 'pending')}</div>
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
            {viewRequest?.remark && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.remark')}</label>
                <p className="text-base bg-muted p-3 rounded-md">{viewRequest.remark}</p>
              </div>
            )}
            {viewRequest?.proofUrl && viewRequest.proofUrl.trim() !== '' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.proofOfPayment')}</label>
                <div className="flex flex-col gap-2">
                  <Image 
                    src={viewRequest.proofUrl} 
                    alt={t('ecash.topupRequests.proofOfPayment')} 
                    width={600} 
                    height={400} 
                    className="rounded-md object-contain border max-w-full h-auto" 
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      const url = viewRequest?.proofUrl?.trim();
                      if (!url) return;

                      // Browsers block navigating the top frame directly to data: URLs.
                      // If this is a data URL, open a new window and inject an <img> tag.
                      if (url.startsWith('data:')) {
                        const win = window.open('', '_blank');
                        if (win) {
                          win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>${t('ecash.topupRequests.proofOfPayment')}</title>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
      }
      img {
        max-width: 100%;
        max-height: 100%;
      }
    </style>
  </head>
  <body>
    <img src="${url}" alt="${t('ecash.topupRequests.proofOfPayment')}" />
  </body>
</html>`);
                          win.document.close();
                        }
                      } else {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {t('ecash.topupRequests.openInNewTab')}
                  </Button>
                </div>
              </div>
            )}
            {(!viewRequest?.proofUrl || viewRequest.proofUrl.trim() === '') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('ecash.topupRequests.proofOfPayment')}</label>
                <p className="text-sm text-muted-foreground italic">{t('ecash.topupRequests.noProofProvided')}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewRequest(null)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ecash.topupRequests.approveTopupRequest')}</DialogTitle>
            <DialogDescription>
              {t('ecash.topupRequests.approveTopupFor', { name: selectedRequest?.memberName || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('ecash.topupRequests.requestedAmount')}</label>
              <div className="text-lg font-bold">{formatPV(selectedRequest?.amount || 0)}</div>
            </div>
            {selectedRequest?.remark && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.topupRequests.remark')}</label>
                <p className="text-sm text-muted-foreground">{selectedRequest.remark}</p>
              </div>
            )}
            {selectedRequest?.proofUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ecash.topupRequests.proofOfPayment')}</label>
                <a 
                  href={selectedRequest.proofUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Image 
                    src={selectedRequest.proofUrl} 
                    alt={t('ecash.topupRequests.proofOfPayment')} 
                    width={300} 
                    height={200} 
                    className="rounded-md object-contain border" 
                  />
                </a>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="adjusted-amount" className="text-sm font-medium">
                {t('ecash.topupRequests.approvedAmount')}
              </label>
              <Input
                id="adjusted-amount"
                type="number"
                step="0.01"
                min="0"
                value={adjustedAmount}
                onChange={(e) => setAdjustedAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
              {t('common.cancel')}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

