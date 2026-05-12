'use client';

import { useState, useEffect } from 'react';
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
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import type { Member } from '@/lib/types';
import { formatCurrency, formatPV } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';

const formSchema = z.object({
  recipientIdentifier: z.string().min(1, 'Recipient phone or email is required.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
});

type TransferFormValues = z.infer<typeof formSchema>;

interface TransferDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  balance: number;
  onTransferSuccess: () => void;
}

export default function TransferDialog({ isOpen, onOpenChange, balance, onTransferSuccess }: TransferDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const { toast } = useToast();
  const { user } = useAuthContext();
  const { t } = useI18n();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientIdentifier: '',
      amount: 0,
    },
  });

  // Update balance when dialog opens or balance prop changes
  useEffect(() => {
    if (isOpen) {
      // Use the balance prop which should match the Current Balance displayed on the page
      setCurrentBalance(balance);
    } else {
      form.reset();
      setIsLoading(false);
    }
  }, [isOpen, balance, form]);

  const onSubmit = async (values: TransferFormValues) => {
    setIsLoading(true);

    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.dialog.authError') });
      setIsLoading(false);
      return;
    }

    // Note: Balance validation is done on the server side (API) which has the source of truth
    // Frontend balance might be stale, so we let the API handle validation
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          title: t('common.error'),
          description: 'Authentication token not found',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/wallet/transfer-pv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientIdentifier: values.recipientIdentifier,
          amount: values.amount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Show detailed error message from API (which has the correct balance)
        const errorMessage = result.error || result.message || 'Transfer failed';
        
        toast({
          title: t('ecash.dialog.failed'),
          description: errorMessage,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: t('ecash.dialog.success'),
        description: result.message || `Successfully transferred ${formatPV(values.amount)} PV`,
        variant: 'default',
      });

      onTransferSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('PV transfer error:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('ecash.dialog.error'),
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
            <ArrowRightLeft /> {t('ecash.dialog.title')}
          </DialogTitle>
           <DialogDescription>
            {t('ecash.dialog.description', { balance: formatPV(currentBalance) }).split(/(<strong>.*?<\/strong>)/).map((part, index) => {
              if (part.startsWith('<strong>')) {
                return <strong key={index}>{formatPV(currentBalance)}</strong>;
              }
              return <span key={index}>{part}</span>;
            })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientIdentifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.dialog.recipientLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('ecash.dialog.recipientPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.dialog.amountLabel')}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder={t('ecash.dialog.amountPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ecash.dialog.confirmButton')}
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {t('ecash.dialog.confirmButton')}
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
