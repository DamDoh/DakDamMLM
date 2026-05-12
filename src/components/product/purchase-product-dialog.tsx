'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Loader2, PlusCircle, Trash2, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCartContext } from '@/context/cart-context';
import type { Member, Product } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'Product is required.'),
  productName: z.string(),
  requestedQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
});

const formSchema = z.object({
  requests: z.array(purchaseItemSchema).min(1, 'You must purchase at least one product.'),
  shippingOption: z.enum(['direct', 'stockist']).default('direct'),
  stockistId: z.string().optional(),
}).refine(data => {
  if (data.shippingOption === 'stockist') {
    return !!data.stockistId;
  }
  return true;
}, {
  message: 'Please select a stockist for pickup.',
  path: ['stockistId'],
});

type PurchaseProductFormValues = z.infer<typeof formSchema>;

interface PurchaseProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  stockist: Member;
  availableProducts: Product[];
}

export default function PurchaseProductDialog({ isOpen, onOpenChange, stockist, availableProducts }: PurchaseProductDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { addToCart } = useCartContext();
  const router = useRouter();
  const [stockists, setStockists] = useState<Member[]>([]);
  const [stockistSearchOpen, setStockistSearchOpen] = useState(false);
  const [loadingStockists, setLoadingStockists] = useState(false);

  // Get current user's storeOwnerLevel for hierarchy filtering
  const currentUserLevel = stockist?.storeOwnerLevel || '';
  const isAdminStock = currentUserLevel && ['S', 'M', 'C', 'D'].includes(currentUserLevel);

  // Define hierarchy: S < M < C < D
  const levelHierarchy: Record<string, number> = { 'S': 1, 'M': 2, 'C': 3, 'D': 4 };
  const getLevelValue = (level: string | null | undefined): number => {
    if (!level) return 0;
    return levelHierarchy[level] || 0;
  };

  const form = useForm<PurchaseProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requests: [{ productId: '', productName: '', requestedQuantity: 1 }],
      shippingOption: 'direct',
      stockistId: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'requests'
  });

  // Fetch stockists with hierarchy filtering for AdminStock users
  const fetchStockists = async () => {
    if (!isAdminStock) {
      setStockists([]);
      return;
    }

    setLoadingStockists(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setStockists([]);
        return;
      }

      const response = await fetch('/api/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch stockists:', response.status);
        setStockists([]);
        return;
      }

      const data = await response.json();
      const members = Array.isArray(data) ? data : (data.data || []);

      const currentLevelValue = getLevelValue(currentUserLevel);

      // Filter stockists: AdminStock can only select higher level AdminStock (S < M < C < D) or Admin
      const eligibleStockists = members.filter((m: any) => {
        // Include Admin users
        if (m.isAdmin && m.active !== false && !m.deleted) {
          return true;
        }

        // Include AdminStock with higher level than current user
        if (m.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(m.storeOwnerLevel)) {
          const stockistLevelValue = getLevelValue(m.storeOwnerLevel);
          // Only include if stockist level is higher than current user's level
          if (stockistLevelValue > currentLevelValue && m.active !== false && !m.deleted) {
            return true;
          }
        }

        return false;
      });

      setStockists(eligibleStockists);
    } catch (error) {
      console.error('Error fetching stockists:', error);
      setStockists([]);
    } finally {
      setLoadingStockists(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      form.reset({
        requests: [{ productId: '', productName: '', requestedQuantity: 1 }],
        shippingOption: 'direct',
        stockistId: '',
      });
      if (isAdminStock) {
        fetchStockists();
      }
    }
  }, [isOpen, form, isAdminStock]);

  const onSubmit = async (values: PurchaseProductFormValues) => {
    setIsLoading(true);
    try {
      // Validate shipping selection
      if (values.shippingOption === 'stockist' && !values.stockistId) {
        toast({
          variant: 'destructive',
          title: t('product.purchase.stockistRequired'),
          description: t('product.purchase.stockistRequiredDesc'),
        });
        setIsLoading(false);
        return;
      }

      // Add each product to cart with shipping information
      let addedCount = 0;
      for (const request of values.requests) {
        const product = availableProducts.find(p => p.id === request.productId);
        if (product) {
          addToCart(product, request.requestedQuantity, {
            shippingOption: values.shippingOption,
            stockistId: values.shippingOption === 'stockist' ? values.stockistId : undefined,
            addressId: undefined, // Purchase product dialog doesn't use addresses - "direct" defaults to Admin
          });
          addedCount += request.requestedQuantity;
        }
      }

      if (addedCount === 0) {
        toast({
          variant: 'destructive',
          title: t('product.purchase.error'),
          description: t('product.purchase.noProductsAdded'),
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: t('product.purchase.productsAddedToCart'),
        description: t('product.purchase.productsAddedToCartDesc', { count: String(addedCount) }),
      });

      onOpenChange(false);

      // Redirect to cart page after adding products
      router.push('/cart');
    } catch (error: any) {
      console.error('Failed to add products to cart:', error);
      toast({
        variant: 'destructive',
        title: t('product.purchase.error'),
        description: error.message || t('product.purchase.failedToAdd'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('product.purchase.title')}
          </DialogTitle>
          <DialogDescription>
            {t('product.purchase.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-end gap-2 p-3 border rounded-lg"
                >
                  <FormField
                    control={form.control}
                    name={`requests.${index}.productId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t('product.requestProduct.productLabel')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            const product = availableProducts.find(p => p.id === value);
                            field.onChange(value);
                            form.setValue(`requests.${index}.productName`, product?.name || '');
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('product.requestProduct.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableProducts.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} - {p.price ? `$${p.price.toFixed(2)}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`requests.${index}.requestedQuantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.product.qtyLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            className="w-24"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => append({ productId: '', productName: '', requestedQuantity: 1 })}
              className="w-full"
              icon={PlusCircle}
            >
              {t('product.requestProduct.addAnother')}
            </Button>

            {/* Shipping Option Selection for AdminStock */}
            {isAdminStock && (
              <div className="space-y-4 pt-4 border-t">
                <FormField
                  control={form.control}
                  name="shippingOption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('product.purchase.shippingMethod')}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                            <RadioGroupItem value="direct" id="direct" className="mt-1" />
                            <Label htmlFor="direct" className="flex-1 cursor-pointer">
                              <div className="font-medium">{t('product.purchase.shipToAddress')}</div>
                              <div className="text-sm text-muted-foreground">
                                {t('product.purchase.shipToAddressDesc')}
                              </div>
                            </Label>
                          </div>
                          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                            <RadioGroupItem value="stockist" id="stockist" className="mt-1" />
                            <Label htmlFor="stockist" className="flex-1 cursor-pointer">
                              <div className="font-medium">{t('product.purchase.pickupFromStockist')}</div>
                              <div className="text-sm text-muted-foreground">
                                {t('product.purchase.pickupFromStockistDesc')}
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Stockist Selection */}
                {form.watch('shippingOption') === 'stockist' && (
                  <FormField
                    control={form.control}
                    name="stockistId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{t('product.purchase.selectStockist')}</FormLabel>
                        <Popover open={stockistSearchOpen} onOpenChange={setStockistSearchOpen}>
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
                                  ? (() => {
                                    const selectedStockist = stockists.find(s => s.id === field.value);
                                    if (selectedStockist) {
                                      const fullName = selectedStockist.fullName || `${selectedStockist.firstName || ''} ${selectedStockist.surname || ''}`.trim() || 'Unknown';
                                      const level = selectedStockist.storeOwnerLevel || '';
                                      const levelLabel = selectedStockist.isAdmin ? 'Admin' : `AdminStock (${level})`;
                                      const location = selectedStockist.addresses?.[0]?.address || 'No location';
                                      return `${fullName} • ${levelLabel} - ${location}`;
                                    }
                                    return t('product.purchase.selectStockist')
                                  })()
                                  : t('product.purchase.selectStockist')}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder={t('product.purchase.searchStockist')} />
                              <CommandList>
                                <CommandEmpty>
                                  {loadingStockists ? t('product.purchase.loadingStockists') : t('product.purchase.noStockistsFound')}
                                </CommandEmpty>
                                <CommandGroup>
                                  {stockists.map((stockist) => {
                                    const fullName = stockist.fullName || `${stockist.firstName || ''} ${stockist.surname || ''}`.trim() || 'Unknown';
                                    const level = stockist.storeOwnerLevel || '';
                                    const levelLabel = stockist.isAdmin ? 'Admin' : `AdminStock (${level})`;
                                    const location = stockist.addresses?.[0]?.address || 'No location';
                                    return (
                                      <CommandItem
                                        value={`${fullName} ${levelLabel} ${location}`}
                                        key={stockist.id}
                                        onSelect={() => {
                                          field.onChange(stockist.id);
                                          setStockistSearchOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === stockist.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <span>{fullName} • {levelLabel}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {t('product.purchase.locationLabel') || 'Location:'} {location}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
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
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isLoading} className="w-full" icon={ShoppingCart}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('product.purchase.addingToCart')}
                  </>
                ) : (
                  t('product.purchase.addToCart')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

