
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
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Member, Product } from '@/lib/types';
import { transferStock } from '@/services/server-actions';
import { useI18n } from '@/lib/internationalization';

const formSchema = z.object({
  productId: z.string().min(1, 'You must select a product.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
});

type TransferFormValues = z.infer<typeof formSchema>;

interface StockTransferDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  stockist: Member;
  onSuccess: () => void;
}

export default function StockTransferDialog({ isOpen, onOpenChange, stockist, onSuccess }: StockTransferDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const { toast } = useToast();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      quantity: 1,
    },
  });

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        console.error('Failed to fetch products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: TransferFormValues) => {
    setIsLoading(true);
    try {
      // Get product details
      const selectedProduct = products.find(p => p.id === values.productId);
      if (!selectedProduct) {
        throw new Error('Product not found');
      }

      // Note: This is an admin-initiated transfer from system/warehouse to stockist
      // Using 'system' as fromUserId for admin transfers
      const result = await transferStock(
        'system', // fromUserId - system/warehouse for admin transfers
        stockist.id, // toUserId
        [{
          productId: values.productId,
          productName: selectedProduct.name,
          quantity: values.quantity,
          unitPrice: selectedProduct.price || 0
        }]
      );

      if (result.success) {
        toast({
          title: t('admin.stock.transferSuccess'),
          description: t('admin.stock.transferTo', { quantity: String(values.quantity), name: stockist.fullName }),
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: t('admin.stock.transferFailed'),
          description: result.message,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('admin.stock.transferError'),
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
            <ArrowRightLeft /> {t('admin.stock.transferStock')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.stock.transferDescription', { name: stockist.fullName })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.stock.product')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.stock.selectProduct')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.qty} {t('admin.stock.inStock')})</SelectItem>
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
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : t('common.confirmTransfer')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
