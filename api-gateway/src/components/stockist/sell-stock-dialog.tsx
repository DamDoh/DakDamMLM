
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Member, Product, StockItem } from '@/lib/types';
import { sellStockToDownline } from '@/services/server-actions';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';

const formSchema = z.object({
  recipientId: z.string().min(1, 'You must select a downline member.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
});

type SellStockFormValues = z.infer<typeof formSchema>;

interface SellStockDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product & { stock: StockItem };
  stockist: Member;
  downline: Member[];
  onSuccess: () => void;
}

export default function SellStockDialog({ isOpen, onOpenChange, product, stockist, downline, onSuccess }: SellStockDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SellStockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientId: '',
      quantity: 1,
    },
  });
  
  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: SellStockFormValues) => {
    setIsLoading(true);
    try {
        if (values.quantity > product.stock.quantity) {
            toast({ variant: 'destructive', title: t('stockist.sell.insufficientStock'), description: t('stockist.sell.insufficientStockDesc', { qty: String(product.stock.quantity) }) });
            setIsLoading(false);
            return;
        }

      const result = await sellStockToDownline({
          stockistId: stockist.id,
          buyerId: values.recipientId,
          productId: product.id,
          quantity: values.quantity,
          unitPrice: product.price,
      });

      if (result.success) {
        toast({
          title: t('stockist.sell.successTitle'),
          description: result.message,
        });
        onSuccess();
        onOpenChange(false);
      } else {
         toast({
            variant: 'destructive',
            title: t('stockist.sell.failedTitle'),
            description: result.message,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('stockist.sell.error'),
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart /> {t('stockist.sell.title')}
          </DialogTitle>
          <DialogDescription>
            {t('stockist.sell.description', { 
                productName: product.name, 
                totalCost: formatCurrency(product.price * (form.watch('quantity') || 1)),
                stockQty: String(product.stock.quantity)
            }).split(/(<strong>.*<\/strong>)/g).map((part, index) => {
                if (part.startsWith('<strong')) {
                    const boldText = part.replace(/<[^>]*>/g, '');
                    return <strong key={index}>{boldText}</strong>
                }
                return part;
            })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('stockist.sell.sellToLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('stockist.sell.selectMemberPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {downline.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.fullName} ({m.memberId})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('cart.quantity')}</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max={product.stock.quantity} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : t('common.confirmSale')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
