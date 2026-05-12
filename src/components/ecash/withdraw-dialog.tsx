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
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency, formatPV } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/types';

const formSchema = z.object({
  recipientId: z.string().min(1, 'Please select a recipient.'),
  amount: z.coerce.number().positive('Amount must be positive.').min(10, 'Minimum withdrawal amount is $10.'),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  remark: z.string().optional(),
});

type WithdrawFormValues = z.infer<typeof formSchema>;

interface WithdrawDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  balance: number;
  onSuccess?: () => void; // Callback to refresh balance after successful withdrawal
}

export default function WithdrawDialog({ isOpen, onOpenChange, balance, onSuccess }: WithdrawDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const { toast } = useToast();
  const { user } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const { rootMember, allMembersMap } = genealogyContext || { rootMember: null, allMembersMap: new Map() };

  // Get all members for recipient search (search by member ID)
  const [allMembers, setAllMembers] = useState<Member[]>([]);

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

        // Fetch all members from API
        const response = await fetch('/api/members', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch members:', response.status);
          // Fallback to allMembersMap if API fails
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
        
        // Filter out inactive/deleted members and self
        const filteredMembers = members.filter((m: any) => 
          m.active !== false && 
          !m.deleted && 
          m.id !== rootMember?.id
        );
        
        setAllMembers(filteredMembers);
      } catch (error) {
        console.error('Error fetching members:', error);
        // Fallback to allMembersMap if API fails
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

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientId: '',
      amount: 0,
      bankAccount: '',
      bankName: '',
      accountName: '',
      remark: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsLoading(false);
      setRecipientSearchQuery('');
      setRecipientSearchOpen(false);
    }
  }, [isOpen, form]);

  const onSubmit = async (values: WithdrawFormValues) => {
    setIsLoading(true);
    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.withdraw.authRequired') });
      setIsLoading(false);
      return;
    }

    // Double-check balance
    if (values.amount > balance) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.withdraw.insufficientBalance'), 
        description: t('ecash.withdraw.insufficientBalanceDesc', { balance: formatCurrency(balance) })
      });
      setIsLoading(false);
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ variant: 'destructive', title: t('ecash.withdraw.authError'), description: t('ecash.withdraw.authErrorDesc') });
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/ecash-withdrawal-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: values.amount,
          remark: values.remark || '',
          bankAccount: values.bankAccount || '',
          bankName: values.bankName || '',
          accountName: values.accountName || '',
          recipientId: values.recipientId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({ 
          variant: 'destructive', 
          title: t('ecash.withdraw.requestFailed'), 
          description: data.error || t('ecash.withdraw.requestFailedDesc')
        });
      } else {
        toast({ title: t('ecash.withdraw.requestSubmitted'), description: data.message || t('ecash.withdraw.requestSubmittedDesc') });
        onOpenChange(false);
        // Refresh balance without reloading the page
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      console.error("E-Cash withdrawal request failed:", error);
      toast({ 
        variant: 'destructive', 
        title: t('common.error'), 
        description: error.message || 'Failed to submit withdrawal request' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('ecash.withdraw.requestTitle')}</DialogTitle>
          <DialogDescription>
            {t('ecash.withdraw.requestDescription', { balance: formatCurrency(balance) })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Recipient Selection - Search by Member ID */}
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('ecash.withdraw.recipientLabel') || 'Recipient'}</FormLabel>
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
                            ? t('common.loading') || 'Loading...'
                            : allMembers.length === 0
                            ? t('ecash.withdraw.noRecipients') || 'No recipients available'
                            : t('ecash.withdraw.searchRecipient') || 'Search by member ID...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder={t('ecash.withdraw.searchRecipient') || "Search by member ID..."} 
                          value={recipientSearchQuery}
                          onValueChange={setRecipientSearchQuery}
                        />
                        <CommandList>
                          {!recipientSearchQuery ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              {t('ecash.withdraw.startTypingToSearch') || "Type to search for members..."}
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>
                                {t('ecash.withdraw.noRecipientFound') || "No recipient found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {allMembers
                                  .filter((r) => {
                                    const searchLower = recipientSearchQuery.toLowerCase();
                                    const fullName = (r.fullName || `${r.firstName || ''} ${r.surname || ''}`.trim() || 'Unknown').toLowerCase();
                                    const memberId = (r.memberId || '').toLowerCase();
                                    return fullName.includes(searchLower) || memberId.includes(searchLower);
                                  })
                                  .map((r) => {
                                    const fullName = r.fullName || `${r.firstName || ''} ${r.surname || ''}`.trim() || 'Unknown';
                                    const memberId = r.memberId || '';
                                    
                                    return (
                                      <CommandItem
                                        value={`${fullName} ${memberId}`}
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
                                          <span className="font-medium">{fullName} ({memberId})</span>
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
                  <FormLabel>{t('ecash.withdraw.amountLabel')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">{t('ecash.withdraw.minimumWithdrawal')}</p>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.withdraw.bankNameLabel')} (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder={t('ecash.withdraw.bankNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.withdraw.accountHolderLabel')} (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder={t('ecash.withdraw.accountHolderPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.withdraw.bankAccountLabel')} (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder={t('ecash.withdraw.bankAccountPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.withdraw.remarkLabel')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('ecash.withdraw.remarkPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
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
                    {t('ecash.withdraw.submitting')}
                  </>
                ) : (
                  t('ecash.withdraw.submitRequest')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

