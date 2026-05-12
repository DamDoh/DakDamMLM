
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, MessageSquare, CheckCircle, XCircle, Clock, FileText, Loader2 } from 'lucide-react';
import { createCommissionDispute, resolveCommissionDispute, getCommissionDisputes, verifyCommissionCalculation } from '@/services/server-actions';
import { useAuthContext } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface CommissionDispute {
  id: string;
  memberId: string;
  commissionId: string;
  reason: 'calculation_error' | 'missing_commission' | 'incorrect_amount' | 'late_payment' | 'other';
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'rejected';
  createdDate: string;
  updatedDate: string;
  adminNotes?: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedDate?: string;
}

interface CommissionDisputesProps {
  isAdmin?: boolean;
  hasCommissionData?: boolean;
}

export default function CommissionDisputes({ isAdmin = false, hasCommissionData: propHasCommissionData }: CommissionDisputesProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const { t } = useI18n();
  const [disputes, setDisputes] = useState<CommissionDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDispute, setShowNewDispute] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  // Use prop value if provided, otherwise default to true for admins
  const effectiveHasCommissionData = propHasCommissionData !== undefined ? propHasCommissionData : (isAdmin ? true : null);

  // New dispute form
  const [newDispute, setNewDispute] = useState<{
    commissionId: string;
    reason: CommissionDispute['reason'] | '';
    description: string;
  }>({
    commissionId: '',
    reason: '',
    description: '',
  });

  // Resolution form state
  const [resolution, setResolution] = useState({
    status: 'resolved' as 'resolved' | 'rejected' | 'investigating',
    notes: '',
  });

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const data = await getCommissionDisputes(isAdmin ? undefined : user?.id);
      setDisputes(data);

      // Commission data check is now handled by props
    } catch (error: any) {
      console.error('CLIENT: Error loading commission disputes:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load commission disputes.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id || isAdmin) {
      loadDisputes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const handleCreateDispute = async () => {
    if (!user?.id || !newDispute.commissionId || !newDispute.reason || !newDispute.description) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    try {
      await createCommissionDispute({
        memberId: user.id,
        commissionId: newDispute.commissionId,
        reason: newDispute.reason as CommissionDispute['reason'], // Cast here after validation
        description: newDispute.description,
      });

      toast({
        title: 'Dispute Filed',
        description: 'Your commission dispute has been submitted successfully.',
      });

      setShowNewDispute(false);
      setNewDispute({ commissionId: '', reason: '', description: '' });
      loadDisputes();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to file commission dispute.',
      });
    }
  };

  const handleResolveDispute = async (disputeId: string) => {
    if (!user?.id) return;

    try {
      await resolveCommissionDispute(disputeId, resolution.notes, user.id);

      toast({
        title: 'Dispute Resolved',
        description: `The dispute has been ${resolution.status}.`,
      });

      setShowResolveDialog(null);
      setResolution({ status: 'resolved', notes: '' });
      loadDisputes();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to resolve dispute.',
      });
    }
  };

  const handleVerifyCalculation = async (commissionId: string) => {
    setVerifying(commissionId);
    try {
      const isValid = await verifyCommissionCalculation(commissionId);

      toast({
        title: isValid ? 'Calculation Verified' : 'Calculation Error Found',
        description: isValid
          ? 'The commission calculation is correct.'
          : 'There appears to be an error in the commission calculation.',
        variant: isValid ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'Could not verify commission calculation.',
      });
    } finally {
      setVerifying(null);
    }
  };

  const getStatusIcon = (status: CommissionDispute['status']) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'investigating':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: CommissionDispute['status']) => {
    const variants = {
      open: 'destructive',
      investigating: 'secondary',
      resolved: 'default',
      rejected: 'outline',
    } as const;

    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p>Loading disputes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Commission Disputes</h2>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage member commission disputes' : 'File and track commission disputes'}
          </p>
        </div>

        {!isAdmin && effectiveHasCommissionData && (
          <Dialog open={showNewDispute} onOpenChange={setShowNewDispute}>
            <DialogTrigger asChild>
              <Button icon={MessageSquare} disabled={!effectiveHasCommissionData}>
                File Dispute
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>File Commission Dispute</DialogTitle>
                <DialogDescription>
                  Submit a dispute for a commission you believe is incorrect.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Commission ID</label>
                  <input
                    type="text"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Enter commission ID"
                    value={newDispute.commissionId}
                    onChange={(e) => setNewDispute(prev => ({ ...prev, commissionId: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <Select
                    value={newDispute.reason}
                    onValueChange={(value: string) =>
                      setNewDispute(prev => ({ ...prev, reason: value as CommissionDispute['reason'] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calculation_error">Calculation Error</SelectItem>
                      <SelectItem value="missing_commission">Missing Commission</SelectItem>
                      <SelectItem value="incorrect_amount">Incorrect Amount</SelectItem>
                      <SelectItem value="late_payment">Late Payment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Describe the issue in detail..."
                    value={newDispute.description}
                    onChange={(e) => setNewDispute(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewDispute(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDispute}>
                  Submit Dispute
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Disputes Found</h3>
            <p className="text-muted-foreground text-center">
              {isAdmin
                ? 'No commission disputes have been filed yet.'
                : 'You haven\'t filed any commission disputes yet.'
              }
            </p>
            {!isAdmin && effectiveHasCommissionData && (
              <Button className="mt-4" onClick={() => setShowNewDispute(true)} disabled={!effectiveHasCommissionData}>
                File Your First Dispute
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <Card key={dispute.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(dispute.status)}
                    <CardTitle className="text-lg">Dispute #{dispute.id.slice(-8)}</CardTitle>
                    {getStatusBadge(dispute.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(dispute.createdDate).toLocaleDateString()}
                  </div>
                </div>
                <CardDescription>
                  Commission ID: {dispute.commissionId} • Reason: {dispute.reason.replace('_', ' ')}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{dispute.description}</p>
                </div>

                {dispute.resolution && (
                  <div>
                    <h4 className="font-medium mb-2">Resolution</h4>
                    <p className="text-sm">{dispute.resolution}</p>
                    {dispute.resolvedDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Resolved on {new Date(dispute.resolvedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {isAdmin && dispute.status === 'open' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerifyCalculation(dispute.commissionId)}
                      disabled={verifying === dispute.commissionId}
                    >
                      {verifying === dispute.commissionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {verifying === dispute.commissionId ? 'Verifying...' : 'Verify Calculation'}
                    </Button>

                    <Dialog open={showResolveDialog === dispute.id} onOpenChange={(open) => {
                      if (open) {
                        setResolution({ status: 'resolved', notes: '' });
                      }
                      setShowResolveDialog(open ? dispute.id : null)
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          Resolve Dispute
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve Commission Dispute</DialogTitle>
                          <DialogDescription>
                            Provide resolution for dispute #{dispute.id.slice(-8)}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Status</label>
                            <Select
                              value={resolution.status}
                              onValueChange={(value: 'resolved' | 'rejected' | 'investigating') =>
                                setResolution(prev => ({ ...prev, status: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="investigating">Under Investigation</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Resolution Notes</label>
                            <Textarea
                              placeholder="Explain the resolution..."
                              value={resolution.notes}
                              onChange={(e) => setResolution(prev => ({ ...prev, notes: e.target.value }))}
                              rows={4}
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowResolveDialog(null)}>
                            Cancel
                          </Button>
                          <Button onClick={() => handleResolveDispute(dispute.id)}>
                            Resolve Dispute
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
    