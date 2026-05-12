
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Upload, AlertCircle, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency, formatPV } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.'),
  remark: z.string().optional(),
  proof: z.any().optional(), // Make proof optional - required only for manual requests
});

type MaintenanceTopUpFormValues = z.infer<typeof formSchema>;

interface MaintenanceTopUpDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  balance: number;
  onSelfSubmit?: () => Promise<void>; // For automatic maintenance when self is selected
  onPayForOther?: (targetMemberId: string, amount: number) => Promise<void>; // Admin Stock pays maintenance for another member (PUT), same flow as rank top-up
  isProcessing?: boolean; // Processing state from parent
}

export default function MaintenanceTopUpDialog({ isOpen, onOpenChange, balance, onSelfSubmit, onPayForOther, isProcessing: externalIsProcessing }: MaintenanceTopUpDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [requiredAmount, setRequiredAmount] = useState<number>(20);
  const [targetType, setTargetType] = useState<'self' | 'other'>('self');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    isMaintained: boolean;
    daysRemaining: number;
    maintainStatus: string;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const { rootMember } = genealogyContext || { rootMember: null };

  // Check if user is Admin Stock - use rootMember from genealogy context which has storeOwnerLevel
  const isAdminStock = React.useMemo(() => {
    if (!rootMember) return false;
    return rootMember.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(rootMember.storeOwnerLevel);
  }, [rootMember]);

  // Fetch members for Admin Stock
  useEffect(() => {
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
        const activeMembers = allMembers.filter((m: any) => 
          m.active !== false && !m.deleted && m.id !== user?.id
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

  // Fetch user's rank, required maintenance amount, and maintenance status (for Admin Stock paying for other)
  useEffect(() => {
    async function fetchDetails() {
      const targetId = targetType === 'other' && selectedMemberId ? selectedMemberId : user?.id;
      if (!targetId || !isOpen) {
        setMaintenanceStatus(null);
        return;
      }
      setLoadingDetails(true);
      setMaintenanceStatus(null);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (!token) {
          setLoadingDetails(false);
          return;
        }

        const response = await fetch(`/api/members/${targetId}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const rank = data.member?.rank || 'Member';
          const { getMaintenanceTopupAmount } = await import('@/lib/maintenance');
          const required = getMaintenanceTopupAmount(rank);
          setRequiredAmount(required);
          form.setValue('amount', required);

          const maintained = !!data.isMaintained;
          const daysRem = typeof data.maintenanceDaysRemaining === 'number' ? data.maintenanceDaysRemaining : 0;
          const status = typeof data.maintainStatus === 'string' ? data.maintainStatus : (maintained ? 'MAINTAINED' : 'NOT_MAINTAINED');
          setMaintenanceStatus({
            isMaintained: maintained,
            daysRemaining: daysRem,
            maintainStatus: status,
          });
        }
      } catch (error) {
        console.error('Failed to fetch required maintenance amount:', error);
        setMaintenanceStatus(null);
      } finally {
        setLoadingDetails(false);
      }
    }
    fetchDetails();
  }, [user?.id, isOpen, targetType, selectedMemberId]);

  const form = useForm<MaintenanceTopUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      remark: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsLoading(false);
      setFileName('');
      setImagePreview(null);
      setTargetType('self');
      setSelectedMemberId('');
      setMemberSearchQuery('');
      setMemberSearchOpen(false);
      setMaintenanceStatus(null);
      setLoadingDetails(false);
    }
  }, [isOpen, form]);

  const selectedMember = members.find(m => m.id === selectedMemberId);
  
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        form.setValue('proof', event.target.files);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: MaintenanceTopUpFormValues) => {
    if (targetType === 'self' && onSelfSubmit) {
      await onSelfSubmit();
      onOpenChange(false);
      return;
    }

    // Same flow as rank top-up: Admin Stock pays for other via PUT (amount, no proof)
    if (targetType === 'other' && isAdminStock && onPayForOther && selectedMemberId) {
      const amt = Number(values.amount) || 0;
      if (!amt || amt < requiredAmount) {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.insufficientPV'),
          description: t('ecash.maintenanceTopup.minimumRequired', { amount: String(requiredAmount) }),
        });
        return;
      }
      if (amt > balance) {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.insufficientPV'),
          description: t('ecash.maintenanceTopup.exceedsBalance', { balance: formatPV(balance) }),
        });
        return;
      }
      setIsLoading(true);
      try {
        await onPayForOther(selectedMemberId, amt);
        onOpenChange(false);
      } catch {
        // Error shown by parent
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.dialog.authError') });
      setIsLoading(false);
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ variant: 'destructive', title: t('ecash.maintenanceTopup.authError'), description: t('ecash.maintenanceTopup.authErrorDesc') });
        setIsLoading(false);
        return;
      }

      // For manual requests (other member or self without automatic), proof is required
      const file = values.proof?.[0];
      if (!file) {
        toast({ variant: 'destructive', title: t('ecash.maintenanceTopup.proofRequired'), description: t('ecash.maintenanceTopup.proofRequiredDesc') });
        setIsLoading(false);
        return;
      }
      const proofUrl = await fileToDataUrl(file);

      const targetMemberId = targetType === 'other' && selectedMemberId ? selectedMemberId : undefined;
       
       const response = await fetch('/api/maintenance-topup-requests', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({
           amount: values.amount,
           remark: values.remark || '',
           proofUrl: proofUrl,
           month: new Date().toISOString().slice(0, 7), // YYYY-MM format
           targetMemberId: targetMemberId, // For Admin Stock to top up for other members
         }),
       });

      let data: any = {};
      const responseText = await response.text();
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse server response:', parseError, 'Response text:', responseText);
        data = { 
          error: t('ecash.maintenanceTopup.parseError'),
          rawResponse: responseText.substring(0, 200)
        };
      }

      if (!response.ok) {
        const errorMsg = data.message || data.error || data.details || `Server error: ${response.status} ${response.statusText}`;
        console.error('Maintenance topup request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMsg,
          data,
          responseText: responseText.substring(0, 500)
        });
        toast({ 
          variant: 'destructive', 
          title: t('ecash.maintenanceTopup.requestFailed'), 
          description: errorMsg
        });
      } else {
        toast({ 
          title: t('ecash.maintenanceTopup.requestSubmitted'), 
          description: data.message || t('ecash.maintenanceTopup.requestSubmittedDesc') 
        });
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Maintenance top-up request failed:", error);
      toast({ variant: 'destructive', title: t('common.error'), description: error.message || t('ecash.dialog.error') });
    } finally {
      setIsLoading(false);
    }
  };

  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-lg">
        <DialogHeader>
          <DialogTitle>{t('ecash.maintenanceTopup.title')}</DialogTitle>
          <DialogDescription>
            {t('ecash.maintenanceTopup.description', { month: currentMonth, balance: formatPV(balance) })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {targetType === 'self' && onSelfSubmit ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('ecash.maintenanceTopup.warning')} {t('ecash.maintenanceTopup.automaticPaymentUsePV')}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('ecash.maintenanceTopup.warning')}
                </AlertDescription>
              </Alert>
            )}

            {/* Target Selection for Admin Stock */}
            {isAdminStock && (
              <div className="space-y-3">
                <Label>{t('ecash.maintenanceTopup.topUpFor')}</Label>
                <RadioGroup value={targetType} onValueChange={(value) => {
                  setTargetType(value as 'self' | 'other');
                  setSelectedMemberId('');
      setMemberSearchQuery('');
      setMemberSearchOpen(false);
                  form.reset();
                }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="self" id="maintenance-self" />
                    <Label htmlFor="maintenance-self" className="cursor-pointer">{t('ecash.maintenanceTopup.myself')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="maintenance-other" />
                    <Label htmlFor="maintenance-other" className="cursor-pointer">{t('ecash.maintenanceTopup.anotherMember')}</Label>
                  </div>
                </RadioGroup>

                {/* Member Search for Admin Stock */}
                {targetType === 'other' && (
                  <div className="space-y-2">
                    <Label>{t('ecash.maintenanceTopup.selectMember')}</Label>
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
                            placeholder={t('ecash.maintenanceTopup.searchPlaceholder')} 
                            value={memberSearchQuery}
                            onValueChange={setMemberSearchQuery}
                          />
                          <CommandList>
                            {!memberSearchQuery ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                {t('ecash.maintenanceTopup.startTypingToSearch') || "Type to search for members..."}
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>{t('ecash.maintenanceTopup.noMemberFound')}</CommandEmpty>
                                <CommandGroup>
                                  {members
                                    .filter((member) => {
                                      const searchLower = memberSearchQuery.toLowerCase();
                                      const fullName = (member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown').toLowerCase();
                                      const memberId = (member.memberId || '').toLowerCase();
                                      return fullName.includes(searchLower) || memberId.includes(searchLower);
                                    })
                                    .map((member) => {
                                      const fullName = member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown';
                                      return (
                                        <CommandItem
                                          value={`${fullName} ${member.memberId || ''}`}
                                          key={member.id}
                                          onSelect={() => {
                                            setSelectedMemberId(member.id);
                                            setMemberSearchOpen(false);
                                            setMemberSearchQuery('');
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              member.id === selectedMemberId ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col flex-1">
                                            <span className="font-medium">{fullName}</span>
                                            <span className="text-sm text-muted-foreground">{member.memberId || ''}</span>
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

            {/* Maintenance status: show when Admin Stock pays for another member – know maintained vs not before top-up */}
            {targetType === 'other' && selectedMemberId && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Maintenance status
                </div>
                {loadingDetails ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </p>
                ) : maintenanceStatus ? (
                  maintenanceStatus.isMaintained ? (
                    <p className="text-sm text-green-700 font-medium">
                      Maintenance paid · {maintenanceStatus.daysRemaining} days remaining for {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 font-medium">
                      Not maintenance · Unpaid for {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            )}

            {/* Amount field - same as rank: show for manual requests and when Admin Stock pays for other (PUT flow) */}
            {(!onSelfSubmit || targetType === 'other') && (
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex justify-between">
                      <span>{t('ecash.maintenanceTopup.amountLabel')}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {requiredAmount} PV {t('ecash.maintenanceTopup.minLabel')} {targetType === 'other' ? `· ${formatPV(balance)} ${t('ecash.maintenanceTopup.maxLabel')}` : ''}
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={`${requiredAmount}`}
                        min={requiredAmount}
                        max={targetType === 'other' ? balance : undefined}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex flex-wrap items-center gap-2">
                      <span>
                        {t('ecash.maintenanceTopup.suggestionByRank', {
                          amount: String(requiredAmount),
                          target: targetType === 'other' ? t('ecash.maintenanceTopup.suggestionTargetOther') : t('ecash.maintenanceTopup.suggestionTargetSelf'),
                        })}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* Show amount info for automatic self-maintenance */}
            {targetType === 'self' && onSelfSubmit && (
              <div className="space-y-2">
                <Label>{t('ecash.maintenanceTopup.maintenanceAmountLabel')}</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">{requiredAmount} PV</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('ecash.maintenanceTopup.maintenanceAmountDesc')}
                  </p>
                </div>
              </div>
            )}
            {/* Proof upload - hide when Admin Stock pays for other (PUT flow, same as rank: no proof) */}
            {(!onSelfSubmit || targetType === 'other') && !(targetType === 'other' && isAdminStock && onPayForOther) && (
              <FormField
                control={form.control}
                name="proof"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Upload className="h-4 w-4" /> {t('ecash.maintenanceTopup.proofLabel')}
                      {targetType === 'self' && onSelfSubmit && (
                        <span className="text-xs text-muted-foreground ml-2">(Optional for automatic)</span>
                      )}
                    </FormLabel>
                    <FormControl>
                       <div className="relative">
                          <Input 
                              id="proof-upload" 
                              type="file" 
                              accept="image/*"
                              required={targetType === 'other'}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleImageChange}
                          />
                           <Button asChild variant="outline" className="w-full">
                             <div>{fileName || t('ecash.maintenanceTopup.uploadButton')}</div>
                           </Button>
                      </div>
                    </FormControl>
                    {imagePreview && (
                      <div className="mt-2">
                          <Image src={imagePreview} alt="Proof preview" width={100} height={100} className="rounded-md border object-contain" />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="remark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.maintenanceTopup.remarkLabel')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('ecash.maintenanceTopup.remarkPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              {targetType === 'other' && isAdminStock && maintenanceStatus?.isMaintained && (
                <p className="text-sm text-muted-foreground w-full text-center">
                  {t('ecash.maintenanceTopup.alreadyPaidNoAction')}
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  !!(isLoading ||
                    externalIsProcessing ||
                    (targetType === 'other' && isAdminStock && maintenanceStatus?.isMaintained))
                }
                className="w-full"
              >
                {isLoading || externalIsProcessing ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    {t('ecash.maintenanceTopup.processing')}
                  </>
                ) : (
                  targetType === 'self' && onSelfSubmit
                    ? t('ecash.maintenanceTopup.title')
                    : targetType === 'other' && isAdminStock && onPayForOther
                    ? t('ecash.maintenanceTopup.payMaintenance')
                    : t('ecash.maintenanceTopup.submitButton')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

