
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

type StockItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  code?: string | null;
  category?: string | null;
};
import { transferStock } from '@/services/server-actions';
import { useI18n } from '@/lib/internationalization';
import { canTransferStock, type StockistLevel } from '@/lib/types';

const formSchema = z.object({
  stockItemId: z.string().min(1, 'You must select a stock item.'),
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
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadingStockItems, setLoadingStockItems] = useState(false);
  const { toast } = useToast();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stockItemId: '',
      quantity: 1,
    },
  });

  useEffect(() => {
    if (isOpen) {
      fetchStockItems();
    }
  }, [isOpen]);

  const fetchStockItems = async () => {
    try {
      setLoadingStockItems(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setStockItems([]);
        return;
      }

      const response = await fetch('/api/stock-items', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const rawData = await response.json();
        const stockItemsData = rawData?.data ?? rawData ?? [];
        const stockItemsArray = Array.isArray(stockItemsData) ? stockItemsData : [];
        // Only show items with quantity > 0
        setStockItems(stockItemsArray.filter((item: StockItem) => item.quantity > 0));
      } else {
        console.error('Failed to fetch stock items:', response.status, response.statusText);
        setStockItems([]);
      }
    } catch (error) {
      console.error('Error fetching stock items:', error);
      setStockItems([]);
    } finally {
      setLoadingStockItems(false);
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
      // Get stock item details
      const selectedStockItem = stockItems.find(item => item.id === values.stockItemId);
      if (!selectedStockItem) {
        throw new Error('Stock item not found');
      }

      // Check if enough quantity available
      if (selectedStockItem.quantity < values.quantity) {
        toast({
          variant: 'destructive',
          title: t('admin.stock.transferFailed'),
          description: `Not enough stock. Available: ${selectedStockItem.quantity}`,
        });
        setIsLoading(false);
        return;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Step 1: Deduct from Stock Items
      const deductResponse = await fetch(`/api/stock-items?id=${selectedStockItem.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: selectedStockItem.quantity - values.quantity
        }),
      });

      if (!deductResponse.ok) {
        throw new Error('Failed to deduct from stock items');
      }

      // Step 2: Add to stockist inventory directly
      const inventoryResponse = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: stockist.id,
          productId: selectedStockItem.id,
          productName: selectedStockItem.name,
          quantity: values.quantity,
          price: selectedStockItem.price || 0,
          operation: 'add'
        }),
      });

      if (inventoryResponse.ok) {
        // Step 3: Calculate and record Stockist Bonus if stockist has a level
        const stockistLevel = stockist.storeOwnerLevel;
        if (stockistLevel && ['S', 'M', 'C', 'D'].includes(stockistLevel)) {
          try {
            // Define bonus rates based on stockist level
            const bonusRates: { [key: string]: number } = {
              'S': 0.008,  // 0.8%
              'M': 0.017,  // 1.7%
              'C': 0.026,  // 2.6%
              'D': 0.03,   // 3%
            };

            const bonusRate = bonusRates[stockistLevel] || 0;
            const transferredPV = selectedStockItem.price * values.quantity;
            const bonusAmount = transferredPV * bonusRate;

            // Record stockist bonus
            await fetch('/api/stockist-bonus', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                stockistId: stockist.id,
                memberId: stockist.id, // The stockist receives the bonus
                transferredPV,
                bonusRate,
                bonusAmount,
                stockistLevel,
              }),
            });
          } catch (bonusError) {
            console.error('Failed to record stockist bonus:', bonusError);
            // Don't fail the transfer if bonus recording fails
          }
        }

        toast({
          title: t('admin.stock.transferSuccess'),
          description: `Transferred ${values.quantity} ${selectedStockItem.name} to ${stockist.fullName}. Stock Items updated.`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        // If transfer fails, restore the stock quantity
        await fetch(`/api/stock-items?id=${selectedStockItem.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity: selectedStockItem.quantity
          }),
        });
        
        const errorData = await inventoryResponse.json().catch(() => ({}));
        toast({
          variant: 'destructive',
          title: t('admin.stock.transferFailed'),
          description: errorData.message || 'Failed to add to stockist inventory',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('admin.stock.transferError'),
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
              name="stockItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Item</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a stock item to transfer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(stockItems) && stockItems.length > 0 ? (
                        stockItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.quantity} available)
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-items" disabled>
                          {loadingStockItems ? 'Loading...' : 'No stock items available'}
                        </SelectItem>
                      )}
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
