
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
  const [resolving, setResolving] = useState<string | null>(null);

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
    if (!isAdmin && !user?.id) {
      setLoading(false);
      return;
    }

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
    loadDisputes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const handleCreateDispute = async () => {
    if (!user?.id || !newDispute.commissionId || !newDispute.reason || !newDispute.description) {
      toast({
        variant: 'destructive',
        title: t('analytics.dispute.validationError'),
        description: t('analytics.dispute.validationErrorDesc'),
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
        title: t('analytics.dispute.disputeFiled'),
        description: t('analytics.dispute.disputeFiledSuccess'),
      });

      setShowNewDispute(false);
      setNewDispute({ commissionId: '', reason: '', description: '' });
      loadDisputes();
    } catch (error: any) {
      const errorMessage = error?.message || '';
      
      // Check for specific error messages
      if (errorMessage.includes('Commission not found') || errorMessage.includes('commission not found')) {
        toast({
          variant: 'destructive',
          title: t('analytics.dispute.commissionNotFound'),
          description: t('analytics.dispute.commissionNotFoundDesc'),
        });
      } else if (errorMessage.includes('You can only dispute your own commissions')) {
        toast({
          variant: 'destructive',
          title: t('analytics.dispute.accessDenied'),
          description: t('analytics.dispute.accessDeniedDesc'),
        });
      } else if (errorMessage.includes('An active dispute already exists')) {
        toast({
          variant: 'destructive',
          title: t('analytics.dispute.disputeAlreadyExists'),
          description: t('analytics.dispute.disputeAlreadyExistsDesc'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('analytics.dispute.error'),
          description: errorMessage || t('analytics.dispute.errorDesc'),
        });
      }
    }
  };

  const handleResolveDispute = async (disputeId: string) => {
    if (!user?.id) return;

    setResolving(disputeId);
    try {
      await resolveCommissionDispute(disputeId, resolution.notes, user.id, resolution.status);

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
    } finally {
      setResolving(null);
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
          <h2 className="text-2xl font-bold">{t('analytics.commissionDisputes')}</h2>
          <p className="text-muted-foreground">
            {isAdmin ? t('analytics.manageMemberCommissionDisputes') : t('analytics.fileAndTrackCommissionDisputes')}
          </p>
        </div>

        {!isAdmin && effectiveHasCommissionData && (
          <Dialog open={showNewDispute} onOpenChange={setShowNewDispute}>
            <DialogTrigger asChild>
              <Button icon={MessageSquare} disabled={!effectiveHasCommissionData}>
                {t('analytics.dispute.fileDispute')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('analytics.dispute.fileCommissionDispute')}</DialogTitle>
                <DialogDescription>
                  {t('analytics.dispute.fileCommissionDisputeDesc')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('analytics.dispute.commissionId')}</label>
                  <input
                    type="text"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder={t('analytics.dispute.commissionIdPlaceholder')}
                    value={newDispute.commissionId}
                    onChange={(e) => setNewDispute(prev => ({ ...prev, commissionId: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">{t('analytics.dispute.reason')}</label>
                  <Select
                    value={newDispute.reason}
                    onValueChange={(value: string) =>
                      setNewDispute(prev => ({ ...prev, reason: value as CommissionDispute['reason'] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('analytics.dispute.selectReason')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calculation_error">{t('analytics.dispute.reasonCalculationError')}</SelectItem>
                      <SelectItem value="missing_commission">{t('analytics.dispute.reasonMissingCommission')}</SelectItem>
                      <SelectItem value="incorrect_amount">{t('analytics.dispute.reasonIncorrectAmount')}</SelectItem>
                      <SelectItem value="late_payment">{t('analytics.dispute.reasonLatePayment')}</SelectItem>
                      <SelectItem value="other">{t('analytics.dispute.reasonOther')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">{t('analytics.dispute.description')}</label>
                  <Textarea
                    placeholder={t('analytics.dispute.descriptionPlaceholder')}
                    value={newDispute.description}
                    onChange={(e) => setNewDispute(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewDispute(false)}>
                  {t('analytics.dispute.cancel')}
                </Button>
                <Button onClick={handleCreateDispute}>
                  {t('analytics.dispute.submitDispute')}
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
            <h3 className="text-lg font-medium mb-2">{t('analytics.noDisputesFound')}</h3>
            <p className="text-muted-foreground text-center">
              {isAdmin
                ? t('analytics.noCommissionDisputesHaveBeenFiledYet')
                : t('analytics.youHaveNotFiledAnyCommissionDisputesYet')
              }
            </p>
            {!isAdmin && effectiveHasCommissionData && (
              <Button className="mt-4" onClick={() => setShowNewDispute(true)} disabled={!effectiveHasCommissionData}>
                {t('analytics.dispute.fileYourFirstDispute')}
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
                    <CardTitle className="text-lg">{t('analytics.dispute.disputeNumber')}{dispute.id.slice(-8)}</CardTitle>
                    {getStatusBadge(dispute.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(dispute.createdDate).toLocaleDateString()}
                  </div>
                </div>
                <CardDescription>
                  {t('analytics.dispute.commissionIdLabel')} {dispute.commissionId} • {t('analytics.dispute.reasonLabel')} {dispute.reason.replace('_', ' ')}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{t('analytics.dispute.description')}</h4>
                  <p className="text-sm text-muted-foreground">{dispute.description}</p>
                </div>

                {dispute.resolution && (
                  <div>
                    <h4 className="font-medium mb-2">{t('analytics.dispute.resolution')}</h4>
                    <p className="text-sm">{dispute.resolution}</p>
                    {dispute.resolvedDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('analytics.dispute.resolvedOn')} {new Date(dispute.resolvedDate).toLocaleDateString()}
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
                      {verifying === dispute.commissionId ? t('analytics.dispute.verifying') : t('analytics.dispute.verifyCalculation')}
                    </Button>

                    <Dialog open={showResolveDialog === dispute.id} onOpenChange={(open) => {
                      if (open) {
                        setResolution({ status: 'resolved', notes: '' });
                      }
                      setShowResolveDialog(open ? dispute.id : null)
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          {t('analytics.dispute.resolveDispute')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('analytics.dispute.resolveCommissionDispute')}</DialogTitle>
                          <DialogDescription>
                            {t('analytics.dispute.resolveCommissionDisputeDesc')}{dispute.id.slice(-8)}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">{t('analytics.dispute.status')}</label>
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
                                <SelectItem value="resolved">{t('analytics.dispute.statusResolved')}</SelectItem>
                                <SelectItem value="rejected">{t('analytics.dispute.statusRejected')}</SelectItem>
                                <SelectItem value="investigating">{t('analytics.dispute.statusInvestigating')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-sm font-medium">{t('analytics.dispute.resolutionNotes')}</label>
                            <Textarea
                              placeholder={t('analytics.dispute.resolutionNotesPlaceholder')}
                              value={resolution.notes}
                              onChange={(e) => setResolution(prev => ({ ...prev, notes: e.target.value }))}
                              rows={4}
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowResolveDialog(null)}
                            disabled={resolving === dispute.id}
                          >
                            {t('analytics.dispute.cancel')}
                          </Button>
                          <Button 
                            onClick={() => handleResolveDispute(dispute.id)}
                            disabled={resolving === dispute.id}
                          >
                            {resolving === dispute.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('analytics.dispute.resolving')}
                              </>
                            ) : (
                              t('analytics.dispute.resolveDispute')
                            )}
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
    