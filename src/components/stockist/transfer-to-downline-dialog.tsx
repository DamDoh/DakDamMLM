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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, ArrowRightLeft, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Member, Product, StockItem } from '@/lib/types';
import { transferStock } from '@/services/server-actions';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import placeholderData from '@/lib/placeholder-images.json';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

const formSchema = z.object({
  recipientId: z.string().min(1, 'You must select a member.'),
  selectedProducts: z.array(z.object({
    productId: z.string(),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  })).min(1, 'You must select at least one product.'),
  // transferType controls where PV goes for the member:
  // 'topup'  -> PV/Rank (Top-Up to Member)
  // 'transfer' -> PV/Product (Transfer to Member)
  transferType: z.enum(['topup', 'transfer']).default('topup'),
});

type TransferStockFormValues = z.infer<typeof formSchema>;

interface TransferToDownlineDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  products: Array<Product & { stock: StockItem }>;
  stockist: Member;
  downline: Member[];
  onSuccess: () => void;
  preSelectedRecipientId?: string; // Optional: pre-select a recipient
  commissionMode?: 'base' | 'differential'; // Commission mode: 'base' for My Stock Page, 'differential' for Binary Stock Page
}

export default function TransferToDownlineDialog({ 
  isOpen, 
  onOpenChange, 
  products,
  stockist, 
  downline, 
  onSuccess,
  preSelectedRecipientId,
  commissionMode = 'base' // Default to 'base' for My Stock Page
}: TransferToDownlineDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [downlineSearchOpen, setDownlineSearchOpen] = useState(false);

  const form = useForm<TransferStockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientId: '',
      selectedProducts: [],
      transferType: 'topup',
    },
  });
  
  useEffect(() => {
    if (isOpen && products.length > 0) {
      // Initialize with all products that were already selected
      const initialProducts = products.map(p => ({
        productId: p.id,
        quantity: 1,
      }));
      const initialIds = new Set(products.map(p => p.id));
      
      form.reset({
        recipientId: preSelectedRecipientId || '',
        selectedProducts: initialProducts,
        transferType: 'topup',
      });
      setSelectedProductIds(initialIds);
    } else if (!isOpen) {
      form.reset();
      setSelectedProductIds(new Set());
    }
  }, [isOpen, products, form, preSelectedRecipientId]);

  // Watch selected products to calculate totals
  const selectedProducts = form.watch('selectedProducts');
  const recipientId = form.watch('recipientId');
  const transferType = form.watch('transferType');

  // Calculate total price and PV
  const totalPrice = selectedProducts.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return sum;
    return sum + (product.price * item.quantity);
  }, 0);

  const totalPV = selectedProducts.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return sum;
    return sum + ((product.pv || 0) * item.quantity);
  }, 0);

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProductIds);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
      // Remove from form
      form.setValue('selectedProducts', selectedProducts.filter(p => p.productId !== productId));
    } else {
      newSelection.add(productId);
      // Add to form with quantity 1
      const product = products.find(p => p.id === productId);
      if (product) {
        form.setValue('selectedProducts', [
          ...selectedProducts,
          { productId, quantity: 1 }
        ]);
      }
    }
    setSelectedProductIds(newSelection);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const updated = selectedProducts.map(p => 
      p.productId === productId ? { ...p, quantity: Math.max(1, quantity) } : p
    );
    form.setValue('selectedProducts', updated);
  };

  const onSubmit = async (values: TransferStockFormValues) => {
    setIsLoading(true);
    try {
      // Validate quantities
      for (const item of values.selectedProducts) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          toast({ 
            variant: 'destructive', 
            title: t('common.error'),
            description: `Product not found for ID: ${item.productId}`
          });
          setIsLoading(false);
          return;
        }
        if (item.quantity > product.stock.quantity) {
          toast({ 
            variant: 'destructive', 
            title: t('stockist.transfer.insufficientStock'), 
            description: `${product.name}: ${t('stockist.transfer.insufficientStockDesc', { qty: String(product.stock.quantity) })}`
          });
          setIsLoading(false);
          return;
        }
      }

      // Prepare items for transfer
      const transferItems = values.selectedProducts.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
        };
      });

      let result: { success: boolean; message?: string; transferId?: string };

      // Binary Stock Page: Use differential commission mode via API endpoint
      if (commissionMode === 'differential') {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/binary-stock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            toUserId: values.recipientId,
            items: transferItems,
          }),
        });

        const responseData = await response.json();
        result = {
          success: responseData.success || false,
          message: responseData.message || responseData.data?.message,
          transferId: responseData.data?.transferId,
        };
      } else {
        // My Stock Page: Use base commission mode via server action
        // Map transferType to PV destination:
        // - 'topup'    -> PV/Rank (Top-Up to Member)
        // - 'transfer' -> PV/Product (Transfer to Member)
        const pvDestination = values.transferType === 'transfer' ? 'product' : 'rank';

        result = await transferStock(
          stockist.id,
          values.recipientId,
          transferItems,
          { pvDestination }
        );
      }

      if (result.success) {
        toast({
          title: t('stockist.transfer.successTitle'),
          description: result.message || t('stockist.transfer.successMessage'),
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: t('stockist.transfer.failedTitle'),
          description: result.message || t('stockist.transfer.error'),
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('stockist.transfer.error'),
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft /> {t('stockist.transfer.title')}
          </DialogTitle>
          <DialogDescription>
            {t('stockist.transfer.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 px-1">
              {/* Transfer Type: Top-Up (PV/Rank) or Transfer (PV/Product) - Hidden for Binary Stock View */}
              {commissionMode !== 'differential' && (
                <FormField
                  control={form.control}
                  name="transferType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('stockist.transfer.typeLabel') || 'Transfer Type'}</FormLabel>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={field.value === 'topup' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => field.onChange('topup')}
                        >
                          {t('stockist.transfer.typeTopup') || 'Top-Up to Member (PV/Rank)'}
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === 'transfer' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => field.onChange('transfer')}
                        >
                          {t('stockist.transfer.typeTransfer') || 'Transfer to Member (PV/Product)'}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {/* Member Selection - Hidden for Binary Stock View (recipient is pre-selected from tree) */}
              {commissionMode !== 'differential' && (
                <FormField
                  control={form.control}
                  name="recipientId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('stockist.transfer.transferToLabel')}</FormLabel>
                      <Popover open={downlineSearchOpen} onOpenChange={setDownlineSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? downline.find((m) => m.id === field.value)?.fullName + 
                                  ` (${downline.find((m) => m.id === field.value)?.memberId})`
                                : t('stockist.transfer.selectMemberPlaceholder')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder={t('stockist.transfer.searchMember') || "Search member..."} 
                            />
                            <CommandList>
                              <CommandEmpty>
                                {t('stockist.transfer.noMemberFound') || "No member found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {downline
                                  .map((m) => (
                                    <CommandItem
                                      value={`${m.fullName} ${m.memberId}`}
                                      key={m.id}
                                      onSelect={() => {
                                        field.onChange(m.id);
                                        setDownlineSearchOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          m.id === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="flex-1">
                                        <span className="font-medium">{m.fullName}</span>
                                        <span className="text-muted-foreground ml-2">({m.memberId})</span>
                                      </span>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Product Selection */}
              <div className="space-y-2">
                <FormLabel>{t('stockist.transfer.selectProducts')}</FormLabel>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {products.map((product) => {
                    const isSelected = selectedProductIds.has(product.id);
                    const selectedItem = selectedProducts.find(p => p.productId === product.id);
                    const imageSrc = imageMap.get(product.imageUrl)?.imageUrl || product.imageUrl;
                    
                    return (
                      <div key={product.id} className="p-3 flex items-start gap-3 hover:bg-muted/50">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                          className="mt-1"
                        />
                        {imageSrc && (
                          <Image 
                            src={imageSrc} 
                            alt={product.name} 
                            width={40} 
                            height={40} 
                            className="rounded-md object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('stockist.myStock.quantity')}: {product.stock.quantity} • 
                            {formatCurrency(product.price)} • PV: {product.pv || 0}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <FormLabel className="text-sm text-muted-foreground whitespace-nowrap">
                              {t('cart.quantity')}:
                            </FormLabel>
                            <Input
                              type="number"
                              min="1"
                              max={product.stock.quantity}
                              value={selectedItem?.quantity || 1}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1;
                                updateQuantity(product.id, Math.min(newQty, product.stock.quantity));
                              }}
                              onBlur={(e) => {
                                const value = parseInt(e.target.value);
                                if (!value || value < 1) {
                                  updateQuantity(product.id, 1);
                                } else if (value > product.stock.quantity) {
                                  updateQuantity(product.id, product.stock.quantity);
                                }
                              }}
                              className="w-24"
                              placeholder="Qty"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {form.formState.errors.selectedProducts && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.selectedProducts.message}
                  </p>
                )}
              </div>

              {/* Summary */}
              {selectedProducts.length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('stockist.transfer.totalPrice')}:</span>
                    <span className="font-semibold">{formatCurrency(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('stockist.transfer.totalPV')}:</span>
                    <span className="font-semibold">{totalPV.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('stockist.transfer.totalItems')}:</span>
                    <span className="font-semibold">{selectedProducts.length}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={isLoading || selectedProducts.length === 0} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    {t('common.processing')}
                  </>
                ) : (
                  t('stockist.transfer.confirmTransfer')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

