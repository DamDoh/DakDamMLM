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
import { ArrowDown, Loader2, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { formatCurrency, formatPV } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.').min(0.01, 'Minimum transfer amount is 0.01 PV.'),
});

type TransferToECashFormValues = z.infer<typeof formSchema>;

interface TransferToECashDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentPv: number;
  onTransferSuccess?: () => void;
}

export default function TransferToECashDialog({ 
  isOpen, 
  onOpenChange, 
  currentPv,
  onTransferSuccess 
}: TransferToECashDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthContext();

  const form = useForm<TransferToECashFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsLoading(false);
    }
  }, [isOpen, form]);

  const onSubmit = async (values: TransferToECashFormValues) => {
    setIsLoading(true);
    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.dialog.authError') });
      setIsLoading(false);
      return;
    }

    // Check if user has sufficient PV
    if (values.amount > currentPv) {
      toast({ 
        variant: 'destructive', 
        title: t('ecash.dialog.errorInsufficientFunds'), 
        description: t('ecash.transferToECash.insufficientPv', { balance: formatPV(currentPv) })
      });
      setIsLoading(false);
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ variant: 'destructive', title: t('ecash.dialog.authError'), description: t('ecash.dialog.authError') });
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/e-cash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amountPv: values.amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || t('ecash.transferToECash.failedDesc');
        
        toast({ 
          variant: 'destructive', 
          title: t('ecash.transferToECash.failed'), 
          description: errorMessage
        });
      } else {
        toast({ 
          title: t('ecash.transferToECash.success'), 
          description: data.message || t('ecash.transferToECash.successDesc', { amount: formatCurrency(values.amount) })
        });
        onOpenChange(false);
        if (onTransferSuccess) {
          onTransferSuccess();
        }
      }
    } catch (error: any) {
      console.error("E-Comm to E-Cash transfer failed:", error);
      toast({ 
        variant: 'destructive', 
        title: t('common.error'), 
        description: error.message || t('ecash.transferToECash.error') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            {t('ecash.transferToECash.title')}
          </DialogTitle>
          <DialogDescription>
            {t('ecash.transferToECash.description', { balance: formatPV(currentPv) })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.transferToECash.amountLabel')} (PV)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      max={currentPv}
                      placeholder="0.00" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {t('ecash.transferToECash.conversionRate')}: 1 PV = $1.00 USD
                  </p>
                  {field.value > 0 && (
                    <div className="p-3 bg-muted rounded-lg mt-2">
                      <p className="text-sm text-muted-foreground">{t('ecash.transferToECash.youWillReceive')}</p>
                      <p className="text-lg font-semibold">{formatCurrency(field.value)}</p>
                    </div>
                  )}
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading || !form.formState.isValid}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <ArrowDown className="h-4 w-4 mr-2" />
                {t('ecash.transferToECash.confirmTransfer')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

