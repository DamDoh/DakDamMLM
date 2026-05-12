'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { formatPV } from '@/lib/utils';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';
import { getPVNeededForNextRank, type Rank } from '@/lib/rank';

interface RankTopUpDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  availablePV: number;
  isLoading: boolean;
  onSubmit: (amount: number, targetMemberId?: string) => Promise<void>;
  /** Current user rank (for "Myself") */
  currentRank?: Rank | string;
  /** Current user PV/Rank (for "Myself") */
  currentPVForRank?: number;
}

export default function RankTopUpDialog({
  isOpen,
  onOpenChange,
  availablePV,
  isLoading,
  onSubmit,
  currentRank: currentRankProp,
  currentPVForRank: currentPVForRankProp,
}: RankTopUpDialogProps) {
  const { t } = useI18n();
  const { user: authUser } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const { rootMember } = genealogyContext || { rootMember: null };
  const [amount, setAmount] = React.useState(availablePV);
  const [error, setError] = React.useState<string | null>(null);
  const [targetType, setTargetType] = React.useState<'self' | 'other'>('self');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [memberSearchOpen, setMemberSearchOpen] = React.useState(false);
  const [members, setMembers] = React.useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = React.useState('');

  // Check if user is Admin Stock - use rootMember from genealogy context which has storeOwnerLevel
  const isAdminStock = React.useMemo(() => {
    if (!rootMember) return false;
    return rootMember.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(rootMember.storeOwnerLevel);
  }, [rootMember]);

  React.useEffect(() => {
    setError(null);
    setTargetType('self');
    setSelectedMemberId('');
    setAmount(availablePV);
    setMemberSearchQuery('');
    setMemberSearchOpen(false);
  }, [availablePV, isOpen]);

  const hasTarget = targetType === 'self' || (targetType === 'other' && !!selectedMemberId);

  // Display rank/PV for target: self (props) or selected member (from list). Only when hasTarget.
  const displayRank = React.useMemo(() => {
    if (!hasTarget) return null;
    if (targetType === 'self') return (currentRankProp ?? rootMember?.rank ?? 'Member') as Rank;
    const m = members.find((x) => x.id === selectedMemberId);
    return (m?.rank ?? 'Member') as Rank;
  }, [hasTarget, targetType, currentRankProp, rootMember?.rank, members, selectedMemberId]);

  const displayPV = React.useMemo(() => {
    if (!hasTarget) return null;
    if (targetType === 'self') {
      const v = currentPVForRankProp ?? rootMember?.pv;
      return typeof v === 'number' ? v : 0;
    }
    const m = members.find((x) => x.id === selectedMemberId);
    const v = m?.pv;
    return typeof v === 'number' ? v : 0;
  }, [hasTarget, targetType, currentPVForRankProp, rootMember?.pv, members, selectedMemberId]);

  const nextRankInfo = React.useMemo(() => {
    if (displayRank == null || displayPV == null) return null;
    return getPVNeededForNextRank(displayRank, displayPV);
  }, [displayRank, displayPV]);

  const suggestedAmount = React.useMemo(() => {
    if (!nextRankInfo || nextRankInfo.pvNeeded <= 0) return null;
    return Math.min(nextRankInfo.pvNeeded, Math.max(0, availablePV));
  }, [nextRankInfo, availablePV]);

  // Pre-fill amount when target/member changes: auto-fill with suggested amount (for next rank) if available, else max available PV
  React.useEffect(() => {
    if (!isOpen) return;
    const useSuggested = hasTarget && suggestedAmount != null && suggestedAmount > 0;
    const value = useSuggested ? suggestedAmount : availablePV;
    setAmount(value);
  }, [isOpen, hasTarget, suggestedAmount, availablePV]);

  // Fetch members for Admin Stock
  React.useEffect(() => {
    if (isOpen && isAdminStock && targetType === 'other') {
      fetchMembers();
    }
  }, [isOpen, isAdminStock, targetType]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setLoadingMembers(false);
        return;
      }

      const response = await fetch('/api/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const allMembers = Array.isArray(data) ? data : (data.data || []);
        // Filter out deleted and inactive members
        const activeMembers = allMembers.filter((m: any) => 
          m.active !== false && !m.deleted && m.id !== authUser?.id
        );
        setMembers(activeMembers);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError(t('ecash.rankTopup.invalidAmount') || 'Enter an amount');
      return;
    }
    if (numericAmount > availablePV) {
      setError(t('ecash.rankTopup.exceedsAvailable') || 'Amount exceeds available PV');
      return;
    }
    if (targetType === 'other' && !selectedMemberId) {
      setError(t('ecash.rankTopup.pleaseSelectMember'));
      return;
    }
    setError(null);
    await onSubmit(numericAmount, targetType === 'other' ? selectedMemberId : undefined);
  };

  const selectedMember = members.find(m => m.id === selectedMemberId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw]">
        <DialogHeader>
          <DialogTitle>{t('ecash.rankTopup.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('ecash.rankTopup.availableDescription', { amount: formatPV(availablePV) })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Selection for Admin Stock */}
          {isAdminStock && (
            <div className="space-y-3">
              <Label>{t('ecash.rankTopup.topUpFor')}</Label>
              <RadioGroup value={targetType} onValueChange={(value) => {
                setTargetType(value as 'self' | 'other');
                setSelectedMemberId('');
              }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="self" id="self" />
                  <Label htmlFor="self" className="cursor-pointer">{t('ecash.rankTopup.myself')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="cursor-pointer">{t('ecash.rankTopup.anotherMember')}</Label>
                </div>
              </RadioGroup>

              {/* Member Search for Admin Stock */}
              {targetType === 'other' && (
                <div className="space-y-2">
                  <Label>{t('ecash.rankTopup.selectMember')}</Label>
                  <Popover 
                    open={memberSearchOpen} 
                    onOpenChange={(open) => {
                      setMemberSearchOpen(open);
                      if (!open) {
                        setMemberSearchQuery('');
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !selectedMemberId && "text-muted-foreground"
                        )}
                        disabled={loadingMembers}
                      >
                        {selectedMemberId
                          ? (() => {
                              const member = selectedMember;
                              if (!member) return 'Select member';
                              const fullName = member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown';
                              return `${fullName} (${member.memberId || ''})`;
                            })()
                          : loadingMembers
                          ? 'Loading members...'
                          : 'Search by ID or name'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder={t('ecash.rankTopup.searchPlaceholder')} 
                            value={memberSearchQuery}
                            onValueChange={setMemberSearchQuery}
                          />
                          <CommandList>
                            {!memberSearchQuery ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                {t('ecash.rankTopup.startTypingToSearch') || "Type to search for members..."}
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>{t('ecash.rankTopup.noMemberFound')}</CommandEmpty>
                                <CommandGroup>
                                  {members
                                    .filter((member) => {
                                      const searchLower = memberSearchQuery.toLowerCase();
                                      const fullName = (member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown').toLowerCase();
                                      const memberId = (member.memberId || '').toLowerCase();
                                      const rank = (member.rank || '').toLowerCase();
                                      return fullName.includes(searchLower) || memberId.includes(searchLower) || rank.includes(searchLower);
                                    })
                                    .map((member) => {
                                      const fullName = member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown';
                                      return (
                                        <CommandItem
                                          value={`${fullName} ${member.memberId || ''} ${member.rank || ''}`}
                                          key={member.id}
                                          onSelect={() => {
                                            setSelectedMemberId(member.id);
                                            setMemberSearchOpen(false);
                                            setMemberSearchQuery('');
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4 shrink-0",
                                              member.id === selectedMemberId ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <span className="font-medium">{fullName}</span>
                                            <span className="text-sm text-muted-foreground">
                                              {[member.memberId, (member.rank || 'Member') + ' · ' + formatPV(Number(member.pv) || 0) + ' PV'].filter(Boolean).join(' · ')}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}

          {/* Rank & PV/Rank for target (self or selected member) – helps Admin Stock add/upgrade easily */}
          {hasTarget && displayRank != null && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <span className="font-medium">{t('ecash.rankTopup.rankLabel')}:</span>
                <span className="text-foreground">{String(displayRank)}</span>
                <span className="text-muted-foreground">|</span>
                <span className="font-medium">{t('ecash.rankTopup.pvRankLabel')}:</span>
                <span className="text-foreground">{formatPV(displayPV ?? 0)}</span>
              </div>
              {nextRankInfo && nextRankInfo.pvNeeded > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {t('ecash.rankTopup.pvNeededForNextRank', {
                      amount: formatPV(nextRankInfo.pvNeeded),
                      rank: nextRankInfo.nextRank,
                    })}
                  </span>
                </div>
              )}
              {hasTarget && displayRank && !nextRankInfo && ['Diamond', 'Manager', 'Director', 'President', 'Double President'].includes(displayRank) && (
                <p className="text-xs text-muted-foreground">{t('ecash.rankTopup.atHighestRank')}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground flex justify-between">
              <span>{t('ecash.rankTopup.amountLabel')}</span>
              <span className="text-xs text-muted-foreground">{formatPV(availablePV)} {t('ecash.rankTopup.maxLabel')}</span>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-2"
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('ecash.rankTopup.processing') : t('ecash.rankTopup.submitButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
