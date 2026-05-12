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
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, PlusCircle, Trash2, Package, MapPin, Store, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Member, Product } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { requestStockTransfer } from '@/services/server-actions';

const requestItemSchema = z.object({
  productId: z.string().min(1, 'Product is required.'),
  productName: z.string(),
  requestedQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
});

const formSchema = z.object({
  requests: z.array(requestItemSchema).min(1, 'You must request at least one product.'),
  shippingMethod: z.enum(['ship_to_address', 'pickup_from_stockist']).default('pickup_from_stockist'),
  stockistId: z.string().optional(),
}).refine(data => {
  if (data.shippingMethod === 'pickup_from_stockist') {
    return !!data.stockistId;
  }
  return true;
}, {
  message: 'Please select a stockist for pickup.',
  path: ['stockistId'],
});

type RequestProductFormValues = z.infer<typeof formSchema>;

interface RequestProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  stockist: Member;
  availableProducts: Product[];
}

export default function RequestProductDialog({ isOpen, onOpenChange, stockist, availableProducts }: RequestProductDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
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

  const form = useForm<RequestProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requests: [{ productId: '', productName: '', requestedQuantity: 1 }],
      shippingMethod: 'pickup_from_stockist',
      stockistId: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'requests'
  });

  // Fetch stockists with hierarchy filtering
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
        shippingMethod: 'pickup_from_stockist',
        stockistId: '',
      });
      if (isAdminStock) {
        fetchStockists();
      }
    }
  }, [isOpen, form, isAdminStock]);

  const onSubmit = async (values: RequestProductFormValues) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        toast({
          variant: 'destructive',
          title: t('product.requestProduct.authRequired'),
          description: t('product.requestProduct.authRequiredDesc'),
        });
        setIsLoading(false);
        return;
      }

      // Validate stockist selection for pickup
      if (values.shippingMethod === 'pickup_from_stockist' && !values.stockistId) {
        toast({
          variant: 'destructive',
          title: t('product.purchase.stockistRequired') || 'Stockist Required',
          description: t('product.purchase.stockistRequiredDesc') || 'Please select a stockist for pickup.',
        });
        setIsLoading(false);
        return;
      }

      // Find selected stockist
      const selectedStockist = stockists.find(s => s.id === values.stockistId);

      // Submit the stock request directly
      const result = await requestStockTransfer({
        stockistId: values.stockistId || stockist.id, // Target stockist
        stockistName: stockist.fullName, // Requester name
        stockistLevel: stockist.storeOwnerLevel || 'S',
        requestedById: stockist.id,
        requestedByName: stockist.fullName,
        requests: values.requests.map(req => ({
          productId: req.productId,
          productName: req.productName,
          requestedQuantity: req.requestedQuantity,
          unitPrice: availableProducts.find(p => p.id === req.productId)?.price || 0,
        })),
        shippingMethod: values.shippingMethod,
      });

      if (result.success) {
        toast({
          title: t('product.requestProduct.successTitle') || 'Request Submitted',
          description: selectedStockist
            ? `Stock request sent to ${selectedStockist.fullName} (${selectedStockist.memberId})`
            : (t('product.requestProduct.successDesc') || 'Your stock request has been submitted successfully.'),
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: t('product.requestProduct.failedTitle') || 'Request Failed',
          description: result.message,
        });
      }
    } catch (error: any) {
      console.error('Product request failed:', error);
      toast({
        variant: 'destructive',
        title: t('product.requestProduct.failedTitle'),
        description: error.message || t('product.requestProduct.failedDesc'),
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
            <Package className="h-5 w-5" />
            {t('product.requestProduct.title')}
          </DialogTitle>
          <DialogDescription>
            {t('product.requestProduct.description')}
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

            {/* Shipping Method Section */}
            <FormField
              control={form.control}
              name="shippingMethod"
              render={({ field }) => (
                <FormItem className="space-y-3 pt-4 border-t">
                  <FormLabel className="text-base font-semibold">
                    {t('product.purchase.shippingMethod')}
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Clear stockist selection when changing shipping method
                        if (value === 'ship_to_address') {
                          form.setValue('stockistId', '');
                        }
                      }}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="ship_to_address" id="request_ship_to_address" className="mt-1" />
                        <Label htmlFor="request_ship_to_address" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 font-medium">
                            <MapPin className="h-4 w-4" />
                            {t('product.purchase.shipToAddress')}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('product.purchase.shipToAddressDesc')}
                          </p>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="pickup_from_stockist" id="request_pickup_from_stockist" className="mt-1" />
                        <Label htmlFor="request_pickup_from_stockist" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 font-medium">
                            <Store className="h-4 w-4" />
                            {t('product.purchase.pickupFromStockist')}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('product.purchase.pickupFromStockistDesc')}
                          </p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Stockist Selection - Shows when "Pick up from Stockist" is selected */}
            {form.watch('shippingMethod') === 'pickup_from_stockist' && (
              <FormField
                control={form.control}
                name="stockistId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('product.purchase.selectStockist') || 'Select Stockist'}</FormLabel>
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
                                  const fullName =
                                    selectedStockist.fullName ||
                                    `${(selectedStockist as any).firstName || ''} ${(selectedStockist as any).surname || ''}`.trim() ||
                                    'Unknown';
                                  const level = selectedStockist.storeOwnerLevel || '';
                                  const levelLabel = (selectedStockist as any).isAdmin ? 'Admin' : `AdminStock (${level})`;
                                  const location =
                                    (selectedStockist as any).addresses?.[0]?.address || 'No location';
                                  return `${fullName} • ${levelLabel} - ${location}`;
                                }
                                return t('product.purchase.selectStockist');
                              })()
                              : loadingStockists
                                ? t('product.purchase.loadingStockists') || 'Loading stockists...'
                                : (t('product.purchase.selectStockistPlaceholder') || 'Select a stockist...')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t('product.purchase.searchStockist') || 'Search stockist...'} />
                          <CommandList>
                            <CommandEmpty>
                              {loadingStockists
                                ? t('product.purchase.loadingStockists') || 'Loading...'
                                : (t('product.purchase.noStockistsFound') || 'No stockist found.')}
                            </CommandEmpty>
                            <CommandGroup>
                              {stockists.map(stockist => {
                                const fullName =
                                  stockist.fullName ||
                                  `${(stockist as any).firstName || ''} ${(stockist as any).surname || ''}`.trim() ||
                                  'Unknown';
                                const level = stockist.storeOwnerLevel || '';
                                const levelLabel = (stockist as any).isAdmin ? 'Admin' : `AdminStock (${level})`;
                                const location =
                                  (stockist as any).addresses?.[0]?.address || 'No location';
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

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('product.requestProduct.submitting')}
                  </>
                ) : (
                  t('product.requestProduct.submitButton') || 'Submit Request'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

