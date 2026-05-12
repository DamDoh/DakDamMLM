'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowRightLeft, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/types';

type TransferFormValues = {
  recipientId: string;
  amount: number;
};

interface TransferECashDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  balance: number;
  onTransferSuccess: () => void;
}

export default function TransferECashDialog({ isOpen, onOpenChange, balance, onTransferSuccess }: TransferECashDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const { toast } = useToast();
  const { user } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const { rootMember, allMembersMap } = genealogyContext || { rootMember: null, allMembersMap: new Map() };
  const { t } = useI18n();

  // Create form schema with translated messages
  const formSchema = useMemo(() => z.object({
    recipientId: z.string().min(1, t('ecash.transferToMember.recipientRequired') || 'Please select a recipient member.'),
    amount: z.coerce.number()
      .positive(t('ecash.transferToMember.amountPositive') || 'Amount must be positive.')
      .min(0.01, t('ecash.transferToMember.amountMin') || 'Minimum amount is $0.01'),
  }), [t]);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientId: '',
      amount: 0,
    },
  });

  // Fetch all members for recipient search
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchAllMembers = async () => {
      setLoadingRecipients(true);
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setLoadingRecipients(false);
          return;
        }

        const response = await fetch('/api/members', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch members:', response.status);
          if (allMembersMap) {
            const members = Array.from(allMembersMap.values()).filter(
              m => m.active !== false && !m.deleted && m.id !== rootMember?.id
            );
            setAllMembers(members);
          }
          setLoadingRecipients(false);
          return;
        }

        const data = await response.json();
        const members = Array.isArray(data) ? data : (data.data || []);
        
        const filteredMembers = members.filter((m: any) => 
          m.active !== false && 
          !m.deleted && 
          m.id !== rootMember?.id
        );
        
        setAllMembers(filteredMembers);
      } catch (error) {
        console.error('Error fetching members:', error);
        if (allMembersMap) {
          const members = Array.from(allMembersMap.values()).filter(
            m => m.active !== false && !m.deleted && m.id !== rootMember?.id
          );
          setAllMembers(members);
        }
      } finally {
        setLoadingRecipients(false);
      }
    };

    fetchAllMembers();
  }, [isOpen, allMembersMap, rootMember]);

  // Update balance when dialog opens or balance prop changes
  useEffect(() => {
    if (isOpen) {
      setCurrentBalance(balance);
    } else {
      form.reset();
      setIsLoading(false);
      setRecipientSearchQuery('');
      setRecipientSearchOpen(false);
    }
  }, [isOpen, balance, form]);

  const onSubmit = async (values: TransferFormValues) => {
    setIsLoading(true);

    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.transferToMember.authRequired') });
      setIsLoading(false);
      return;
    }

    // Validate balance on frontend
    if (values.amount > currentBalance) {
      toast({
        variant: 'destructive',
        title: t('ecash.transferToMember.insufficientBalance'),
        description: t('ecash.transferToMember.insufficientBalanceDesc', { balance: formatCurrency(currentBalance) })
      });
      setIsLoading(false);
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          title: t('common.error'),
          description: t('ecash.transferToMember.authError'),
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Get selected member to find their memberId
      const selectedMember = allMembers.find(m => m.id === values.recipientId);
      if (!selectedMember || !selectedMember.memberId) {
        toast({
          variant: 'destructive',
          title: t('ecash.transferToMember.invalidRecipient'),
          description: t('ecash.transferToMember.invalidRecipientDesc')
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/e-cash/transfer-to-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientIdentifier: selectedMember.memberId, // Use memberId for API
          amount: values.amount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || result.message || 'Transfer failed';
        toast({
          title: t('ecash.transferToMember.transferFailed'),
          description: errorMessage,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: t('ecash.transferToMember.transferSuccessful'),
        description: result.message || t('ecash.transferToMember.transferSuccessfulDesc', { amount: formatCurrency(values.amount) }),
        variant: 'default',
      });

      onTransferSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('E-Cash transfer error:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('ecash.transferToMember.unexpectedError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft /> {t('ecash.transferToMember.title')}
          </DialogTitle>
          <DialogDescription>
            {t('ecash.transferToMember.description', { balance: formatCurrency(currentBalance) }).split(/(<strong>.*?<\/strong>)/).map((part, index) => {
              if (part.startsWith('<strong>')) {
                return <strong key={index}>{formatCurrency(currentBalance)}</strong>;
              }
              return <span key={index}>{part}</span>;
            })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('ecash.transferToMember.recipientLabel')}</FormLabel>
                  <Popover 
                    open={recipientSearchOpen} 
                    onOpenChange={(open) => {
                      setRecipientSearchOpen(open);
                      if (!open) {
                        setRecipientSearchQuery('');
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between h-auto min-h-10 py-2",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={loadingRecipients || allMembers.length === 0}
                        >
                          {field.value
                            ? (() => {
                                const selected = allMembers.find((r) => r.id === field.value);
                                if (!selected) return '';
                                const fullName = selected.fullName || `${selected.firstName || ''} ${selected.surname || ''}`.trim() || 'Unknown';
                                const memberId = selected.memberId || '';
                                return `${fullName} (${memberId})`;
                              })()
                            : loadingRecipients
                            ? t('ecash.transferToMember.loadingMembers')
                            : allMembers.length === 0
                            ? t('ecash.transferToMember.noMembersAvailable')
                            : t('ecash.transferToMember.searchPlaceholder')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder={t('ecash.transferToMember.searchPlaceholder')} 
                          value={recipientSearchQuery}
                          onValueChange={setRecipientSearchQuery}
                        />
                        <CommandList>
                          {!recipientSearchQuery ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              {t('ecash.transferToMember.startTypingToSearch')}
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>
                                {t('ecash.transferToMember.noMemberFound')}
                              </CommandEmpty>
                              <CommandGroup>
                                {allMembers
                                  .filter((r) => {
                                    const searchLower = recipientSearchQuery.toLowerCase();
                                    const memberId = (r.memberId || '').toLowerCase();
                                    const fullName = (r.fullName || `${r.firstName || ''} ${r.surname || ''}`.trim() || 'Unknown').toLowerCase();
                                    // Search by Member ID first, then by name
                                    return memberId.includes(searchLower) || fullName.includes(searchLower);
                                  })
                                  .map((r) => {
                                    const fullName = r.fullName || `${r.firstName || ''} ${r.surname || ''}`.trim() || 'Unknown';
                                    const memberId = r.memberId || '';
                                    
                                    return (
                                      <CommandItem
                                        value={`${memberId} ${fullName}`}
                                        key={r.id}
                                        onSelect={() => {
                                          field.onChange(r.id);
                                          setRecipientSearchOpen(false);
                                          setRecipientSearchQuery('');
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            r.id === field.value ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col flex-1">
                                          <span className="font-medium">{fullName}</span>
                                          <span className="text-xs text-muted-foreground">{t('ecash.transferToMember.memberIdLabel')}: {memberId}</span>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.transferToMember.amountLabel')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder={t('ecash.transferToMember.amountPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">{t('ecash.transferToMember.minimumAmount')}</p>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ecash.transferToMember.transferring')}
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {t('ecash.transferToMember.confirmButton')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
