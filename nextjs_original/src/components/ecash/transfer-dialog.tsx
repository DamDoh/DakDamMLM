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
import { ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import type { Member } from '@/lib/types';
import { transferECash } from '@/services/server-actions';
import { formatCurrency } from '@/lib/utils';
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
  allMembers: Member[];
}

export default function TransferDialog({ isOpen, onOpenChange, balance, onTransferSuccess }: TransferDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsLoading(false);
    }
  }, [isOpen, form]);

  const onSubmit = async (values: TransferFormValues) => {
    setIsLoading(true);

    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.dialog.authError') });
      setIsLoading(false);
      return;
    }

    try {
      const result = await transferECash({
        senderId: user.memberId || user.id,
        recipientIdentifier: values.recipientIdentifier,
        amount: values.amount,
      });

      toast({
        title: result.success ? t('ecash.dialog.success') : t('ecash.dialog.failed'),
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });

      if (result.success) {
        onTransferSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: t('common.error'),
        description: t('ecash.dialog.error'),
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
            {t('ecash.dialog.description', { balance: formatCurrency(balance) }).split(/(<span.*<\/span>)/).map((part, index) => {
              if (part.startsWith('<span')) {
                return <span key={index} className="font-bold">{formatCurrency(balance)}</span>;
              }
              return part;
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
              <Button type="submit" disabled={isLoading} className="w-full" icon={isLoading ? "loading" : "transfer"}>
                {isLoading ? (
                  <span className="animate-spin"></span>
                ) : (
                    t('ecash.dialog.confirmButton')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
