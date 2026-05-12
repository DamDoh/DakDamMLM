'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { formatPV } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface CurrentPeriodVolumeProps {
  userId?: string;
}

interface VolumeData {
  leftPV: number;           // G1 left PV for display
  rightPV: number;          // G1 right PV for display
  leftWaitingPV: number;    // Waiting PV left (SOURCE OF TRUTH)
  rightWaitingPV: number;   // Waiting PV right (SOURCE OF TRUTH)
  leftTotalPV: number;      // Same as waiting (for compatibility)
  rightTotalPV: number;     // Same as waiting (for compatibility)
  matchedPV: number;        // PV matched today
  teamSize?: {
    left: number;
    right: number;
    total: number;
  };
}

export default function CurrentPeriodVolume({ userId }: CurrentPeriodVolumeProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = React.useState(true);
  const [volumeData, setVolumeData] = React.useState<VolumeData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  
  // Simple currency formatter
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const fetchVolumeData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = userId 
        ? `/api/pv-matching/current-period?userId=${userId}`
        : '/api/pv-matching/current-period';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        if (response.status === 403) {
          // Non-admin viewing other user's data - show limited view
          setVolumeData({
            leftPV: 0,
            rightPV: 0,
            leftWaitingPV: 0,
            rightWaitingPV: 0,
            leftTotalPV: 0,
            rightTotalPV: 0,
            matchedPV: 0,
            teamSize: { left: 0, right: 0, total: 0 }
          });
          setError('Volume data is only visible to the member or admins');
          return;
        }
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch volume data' }));
        throw new Error(errorData.message || 'Failed to fetch volume data');
      }

      const result = await response.json();
      if (result.success && result.data) {
        const data = {
          leftPV: result.data.leftPV || 0,
          rightPV: result.data.rightPV || 0,
          leftWaitingPV: result.data.leftWaitingPV || 0,
          rightWaitingPV: result.data.rightWaitingPV || 0,
          leftTotalPV: result.data.leftTotalPV || 0,
          rightTotalPV: result.data.rightTotalPV || 0,
          matchedPV: result.data.matchedPV || 0,
          teamSize: result.data.teamSize || { left: 0, right: 0, total: 0 },
        };
        
        setVolumeData(data);
        // Note: Auto-trigger is handled by the API endpoint, no need to trigger here
      } else {
        throw new Error(result.message || 'Failed to fetch volume data');
      }
    } catch (err) {
      console.error('Error fetching volume data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch on mount and when userId changes
  React.useEffect(() => {
    fetchVolumeData();
  }, [fetchVolumeData]);

  const handleClaimDailyMatch = async () => {
    try {
      setClaiming(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Please log in again.',
        });
        return;
      }

      const response = await fetch('/api/bonus/daily-match', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      // Log debug info to browser console
      if (result.debug) {
        console.group('🔍 Daily Match PV Calculation Debug');
        console.log('Step 1 - Live PV from Binary Tree:', result.debug.calculation.step1_livePV);
        console.log('Step 2 - Waiting PV Source:', result.debug.calculation.step2_waitingPV);
        console.log('Step 3 - Total PV Calculation:', result.debug.calculation.step3_totalPV);
        console.log('Step 4 - Matched PV:', result.debug.calculation.step4_matchedPV);
        console.log('Step 5 - Remaining Waiting PV:', result.debug.calculation.step5_remainingWaitingPV);
        console.log('Step 6 - Commission:', result.debug.calculation.step6_commission);
        console.log('Final Waiting PV:', result.waitingPV);
        console.groupEnd();
      }

      if (result.success) {
        toast({
          title: 'Daily Match Claimed',
          description: result.message || `Commission of ${formatCurrency(result.commission?.amount || 0)} has been credited to your E-Cash wallet.`,
        });
        // Refresh volume data to show updated waiting PV
        await fetchVolumeData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Cannot Claim Daily Match',
          description: result.message || 'Unable to claim Daily Match bonus. Please check your eligibility.',
        });
      }
    } catch (err) {
      console.error('Error claiming Daily Match:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to claim Daily Match bonus.',
      });
    } finally {
      setClaiming(false);
    }
  };

  // Note: potentialCommission is calculated later using waiting PV

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !volumeData) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            {error || 'No volume data available'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentages for visualization
  const maxPV = Math.max(volumeData.leftWaitingPV, volumeData.rightWaitingPV, 1);
  const leftPercentage = maxPV > 0 ? (volumeData.leftWaitingPV / maxPV) * 100 : 0;
  const rightPercentage = maxPV > 0 ? (volumeData.rightWaitingPV / maxPV) * 100 : 0;

  // Calculate matchable PV (this is the PV that CAN be matched right now)
  // Note: This value updates automatically after each match, even if daily cap is reached
  // For example, Silver rank (10 pairs/day): if 11th match happens, no commission but PV still subtracts
  const matchablePV = Math.min(volumeData.leftWaitingPV, volumeData.rightWaitingPV);
  const potentialCommission = matchablePV * 0.08;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {t('genealogy.teamPerformance')}
            </CardTitle>
            <CardDescription>
              {t('genealogy.teamPerformanceDesc')}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchVolumeData}
            title={t('binaryStock.refresh')}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Left Leg Waiting PV */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {t('genealogy.leftWaiting')} PV
              </span>
            </div>
            <span className="font-bold text-blue-600">{formatPV(volumeData.leftWaitingPV)}</span>
          </div>
          <div className="relative h-6 bg-muted rounded-md overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${leftPercentage}%` }}
            />
          </div>
        </div>

        {/* Right Leg Waiting PV */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-green-500" />
              <span className="font-medium">
                {t('genealogy.rightWaiting')} PV
              </span>
            </div>
            <span className="font-bold text-green-600">{formatPV(volumeData.rightWaitingPV)}</span>
          </div>
          <div className="relative h-6 bg-muted rounded-md overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
              style={{ width: `${rightPercentage}%` }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <p className="text-xs text-muted-foreground mb-1">
                {t('genealogy.leftWaiting')}
              </p>
              <p className="text-xl font-bold text-blue-600">{formatPV(volumeData.leftWaitingPV)}</p>
              {volumeData.teamSize && volumeData.teamSize.left > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('genealogy.members')}: {volumeData.teamSize.left}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <p className="text-xs text-muted-foreground mb-1">
                {t('genealogy.rightWaiting')}
              </p>
              <p className="text-xl font-bold text-green-600">{formatPV(volumeData.rightWaitingPV)}</p>
              {volumeData.teamSize && volumeData.teamSize.right > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('genealogy.members')}: {volumeData.teamSize.right}
                </p>
              )}
            </div>
          </div>
          
          {/* Matchable PV Info */}
          {matchablePV > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('genealogy.matchablePV') || 'Matchable PV'}
                </p>
                <p className="text-lg font-semibold text-amber-600">
                  {formatPV(matchablePV)} PV
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('genealogy.potentialCommission', {
                    amount: potentialCommission.toFixed(2),
                    percent: '8',
                  }) || `Potential: $${potentialCommission.toFixed(2)} (8%)`}
                </p>
              </div>
            </div>
          )}
          
          {/* Team Size Summary */}
          {volumeData.teamSize && volumeData.teamSize.total > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('genealogy.totalTeamMembers') || 'Total Team Members'}
                </p>
                <p className="text-lg font-semibold">
                  {volumeData.teamSize.total} {t('genealogy.members')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('genealogy.teamMembersBreakdown', {
                    left: String(volumeData.teamSize.left),
                    right: String(volumeData.teamSize.right),
                  }) ||
                    `(${volumeData.teamSize.left} left + ${volumeData.teamSize.right} right)`}
                </p>
              </div>
            </div>
          )}
          
          {/* Additional Info */}
          {volumeData.matchedPV > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Matched Today: {formatPV(volumeData.matchedPV)} PV
              </p>
            </div>
          )}
          
          {/* Explanation */}
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-center text-muted-foreground">
              {volumeData.leftWaitingPV > volumeData.rightWaitingPV 
                ? t('genealogy.leftHasMoreWaiting', {
                    amount: formatPV(volumeData.leftWaitingPV - volumeData.rightWaitingPV),
                  }) || `Left has ${formatPV(volumeData.leftWaitingPV - volumeData.rightWaitingPV)} PV waiting for right leg`
                : volumeData.rightWaitingPV > volumeData.leftWaitingPV
                ? t('genealogy.rightHasMoreWaiting', {
                    amount: formatPV(volumeData.rightWaitingPV - volumeData.leftWaitingPV),
                  }) || `Right has ${formatPV(volumeData.rightWaitingPV - volumeData.leftWaitingPV)} PV waiting for left leg`
                : volumeData.leftWaitingPV > 0 && volumeData.rightWaitingPV > 0
                ? t('genealogy.legsBalanced') || 'Both legs are balanced - ready to match!'
                : t('genealogy.addMembersForPV') || 'Add new members to build your waiting PV'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
