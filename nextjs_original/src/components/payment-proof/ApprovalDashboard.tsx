'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Check, X, AlertTriangle, Download, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PaymentProof {
  id: string;
  orderId: string;
  amount: number;
  status: 'uploaded' | 'approved' | 'rejected' | 'escalated';
  createdAt: string;
  user: {
    firstName: string;
    surname: string;
    email: string;
  };
  order: {
    orderId: string;
    amount: number;
  };
}

interface ApprovalDashboardProps {
  userRole: 'upline' | 'admin';
}

export const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({ userRole }) => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProofs, setSelectedProofs] = useState<string[]>([]);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    proof: PaymentProof | null;
    action: 'approve' | 'reject' | null;
  }>({
    open: false,
    proof: null,
    action: null
  });
  const [reviewNotes, setReviewNotes] = useState('');
  const [filters, setFilters] = useState({
    status: 'uploaded',
    page: 1,
    limit: 10
  });

  useEffect(() => {
    fetchPendingApprovals();
  }, [filters]);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        status: filters.status,
        page: filters.page.toString(),
        limit: filters.limit.toString()
      });

      const response = await fetch(`/api/payment-proofs/approvals/pending?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch approvals');

      const data = await response.json();
      setProofs(data.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load pending approvals'
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (proof: PaymentProof, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/payment-proofs/approvals/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofId: proof.id,
          action,
          notes: reviewNotes.trim()
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Review failed');
      }

      toast({
        title: 'Success',
        description: `Proof ${action}d successfully`
      });
      setReviewDialog({ open: false, proof: null, action: null });
      setReviewNotes('');
      fetchPendingApprovals(); // Refresh the list
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Review failed'
      });
      console.error(error);
    }
  };

  const handleBulkReview = async (action: 'approve' | 'reject') => {
    if (selectedProofs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select proofs to review'
      });
      return;
    }

    try {
      const response = await fetch('/api/payment-proofs/approvals/bulk-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofIds: selectedProofs,
          action,
          notes: `Bulk ${action} operation`
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bulk review failed');
      }

      const result = await response.json();
      toast({
        title: 'Success',
        description: `${result.data.count} proofs ${action}d successfully`
      });
      setSelectedProofs([]);
      fetchPendingApprovals();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Bulk review failed'
      });
      console.error(error);
    }
  };

  const handleDownload = async (proofId: string) => {
    try {
      const response = await fetch(`/api/payment-proofs/${proofId}/download`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-proof-${proofId}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to download proof'
      });
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      uploaded: 'default',
      approved: 'default',
      rejected: 'destructive',
      escalated: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const toggleProofSelection = (proofId: string) => {
    setSelectedProofs(prev =>
      prev.includes(proofId)
        ? prev.filter(id => id !== proofId)
        : [...prev, proofId]
    );
  };

  const toggleAllProofs = () => {
    setSelectedProofs(prev =>
      prev.length === proofs.length ? [] : proofs.map(p => p.id)
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payment Proof Approvals</span>
            <div className="flex gap-2">
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uploaded">Pending</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          {selectedProofs.length > 0 && (
            <div className="flex gap-2 mb-4 p-3 bg-blue-50 rounded-md">
              <span className="text-sm font-medium">
                {selectedProofs.length} proof{selectedProofs.length > 1 ? 's' : ''} selected
              </span>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleBulkReview('approve')}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkReview('reject')}
              >
                <X className="h-4 w-4 mr-1" />
                Reject All
              </Button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">Loading approvals...</div>
          ) : proofs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending approvals found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProofs.length === proofs.length && proofs.length > 0}
                      onCheckedChange={toggleAllProofs}
                    />
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.map((proof) => (
                  <TableRow key={proof.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProofs.includes(proof.id)}
                        onCheckedChange={() => toggleProofSelection(proof.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {proof.order.orderId}
                    </TableCell>
                    <TableCell>
                      {proof.user.firstName} {proof.user.surname}
                      <div className="text-sm text-gray-500">{proof.user.email}</div>
                    </TableCell>
                    <TableCell>${proof.amount?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell>
                      {format(new Date(proof.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{getStatusBadge(proof.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(proof.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Dialog
                          open={reviewDialog.open && reviewDialog.proof?.id === proof.id}
                          onOpenChange={(open) =>
                            setReviewDialog(prev => ({ ...prev, open }))
                          }
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Review Payment Proof</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <strong>Order:</strong> {proof.order.orderId}
                              </div>
                              <div>
                                <strong>Member:</strong> {proof.user.firstName} {proof.user.surname}
                              </div>
                              <div>
                                <strong>Amount:</strong> ${proof.amount?.toFixed(2) || 'N/A'}
                              </div>
                              <div>
                                <strong>Submitted:</strong> {format(new Date(proof.createdAt), 'PPP')}
                              </div>
                              <Textarea
                                placeholder="Add review notes (optional)"
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleReview(proof, 'approve')}
                                  className="flex-1"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => handleReview(proof, 'reject')}
                                  variant="destructive"
                                  className="flex-1"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {proofs.filter(p => p.status === 'uploaded').length}
              </div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {proofs.filter(p => p.status === 'approved').length}
              </div>
              <div className="text-sm text-gray-500">Approved Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {proofs.filter(p => p.status === 'rejected').length}
              </div>
              <div className="text-sm text-gray-500">Rejected Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {proofs.filter(p => p.status === 'escalated').length}
              </div>
              <div className="text-sm text-gray-500">Escalated</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};