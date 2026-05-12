
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Send, PlusCircle, Trash2, MapPin, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Member, Product, StockistLevel } from '@/lib/types';

type StockItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  code?: string | null;
  category?: string | null;
};
import { stockistLevels } from '@/lib/types';
import { requestStockTransfer } from '@/services/server-actions';
import { useI18n } from '@/lib/internationalization';
import { useGenealogyContext } from '@/context/genealogy-context';

const requestItemSchema = z.object({
  productId: z.string().min(1, 'Stock item is required.'),
  productName: z.string(),
  requestedQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.coerce.number().optional(),
});

const formSchema = z.object({
  requests: z.array(requestItemSchema).min(1, 'You must request at least one stock item.'),
  shippingMethod: z.enum(['ship_to_address', 'pickup_from_stockist']).default('pickup_from_stockist'),
});

type RequestStockFormValues = z.infer<typeof formSchema>;

interface RequestStockDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  stockist: Member;
  availableProducts: Product[];
}

export default function RequestStockDialog({ isOpen, onOpenChange, stockist, availableProducts }: RequestStockDialogProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadingStockItems, setLoadingStockItems] = useState(false);
  const { toast } = useToast();
  const context = useGenealogyContext();
  const { allMembersMap } = context || { allMembersMap: new Map() };

  // Fetch Stock Items when dialog opens
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

  // Find upline stockist (S, M, C, or D) for the requesting member
  const findUplineStockist = (member: Member): Member | null => {
    if (!member.sponsorId) return null;

    let currentSponsorId = member.sponsorId;
    const visited = new Set<string>();

    // Walk up the sponsor chain to find the first stockist with level S, M, C, or D
    while (currentSponsorId && !visited.has(currentSponsorId)) {
      visited.add(currentSponsorId);
      const sponsor = allMembersMap.get(currentSponsorId);

      if (!sponsor) break;

      // Check if sponsor has stockist level S, M, C, or D
      if (sponsor.storeOwnerLevel && stockistLevels.includes(sponsor.storeOwnerLevel as StockistLevel)) {
        return sponsor;
      }

      // Move up to next sponsor
      currentSponsorId = sponsor.sponsorId || '';
    }

    return null;
  };

  const form = useForm<RequestStockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requests: [{ productId: '', productName: '', requestedQuantity: 1, unitPrice: 0 }],
      shippingMethod: 'pickup_from_stockist',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "requests"
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        requests: [{ productId: '', productName: '', requestedQuantity: 1, unitPrice: 0 }],
        shippingMethod: 'pickup_from_stockist'
      });
    }
  }, [isOpen, form]);

  const onSubmit = async (values: RequestStockFormValues) => {
    setIsLoading(true);
    try {
      // Check if the requesting member has stockist level (S, M, C, D)
      const hasStockistLevel = stockist.storeOwnerLevel &&
        stockistLevels.includes(stockist.storeOwnerLevel as StockistLevel);

      if (hasStockistLevel) {
        // AdminStock users: Redirect to Binary Stock page to select target AdminStock
        // Store request data in sessionStorage for retrieval on Binary Stock page
        const requestData = {
          requests: values.requests.map(req => ({
            ...req,
            unitPrice: stockItems.find(item => item.id === req.productId)?.price || 0
          })),
          shippingMethod: values.shippingMethod,
          requesterId: stockist.id,
          requesterName: stockist.fullName,
          requesterLevel: stockist.storeOwnerLevel,
        };

        sessionStorage.setItem('pendingStockRequest', JSON.stringify(requestData));

        toast({
          title: t('stockist.request.selectTargetTitle') || 'Select Target AdminStock',
          description: t('stockist.request.selectTargetDesc') || 'Please select an AdminStock from the binary tree to send your request.',
        });

        onOpenChange(false);

        // Redirect to Binary Stock page with a flag to show selection mode
        router.push('/binary-stock?selectTarget=true');
      } else {
        // Non-stockist members: This shouldn't happen, but handle gracefully
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: 'Only AdminStock members can request stock.',
        });
      }
    } catch (error: any) {
      console.error("Stock request failed:", error);
      toast({ variant: 'destructive', title: t('common.error'), description: error.message || t('stockist.request.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send /> {t('stockist.request.title')}
          </DialogTitle>
          <DialogDescription>
            {t('stockist.request.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                  <FormField
                    control={form.control}
                    name={`requests.${index}.productId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Stock Item</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            const stockItem = stockItems.find(item => item.id === value);
                            field.onChange(value);
                            form.setValue(`requests.${index}.productName`, stockItem?.name || '');
                          }}
                          value={field.value}
                        >
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
                    name={`requests.${index}.requestedQuantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.product.qty')}</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} className="w-24" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => append({ productId: '', productName: '', requestedQuantity: 1, unitPrice: 0 })}
              className="w-full"
              icon={PlusCircle}
            >
              {t('stockist.request.addAnother')}
            </Button>

            {/* Shipping Method Section */}
            <FormField
              control={form.control}
              name="shippingMethod"
              render={({ field }) => (
                <FormItem className="space-y-3 pt-4 border-t">
                  <FormLabel className="text-base font-semibold">
                    {t('stockist.request.shippingMethod') || 'Shipping Method'}
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="ship_to_address" id="ship_to_address" className="mt-1" />
                        <Label htmlFor="ship_to_address" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 font-medium">
                            <MapPin className="h-4 w-4" />
                            {t('stockist.request.shipToAddress') || 'Ship to Address'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('stockist.request.shipToAddressDesc') || 'Deliver to your default address or specify a new one.'}
                          </p>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="pickup_from_stockist" id="pickup_from_stockist" className="mt-1" />
                        <Label htmlFor="pickup_from_stockist" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 font-medium">
                            <Store className="h-4 w-4" />
                            {t('stockist.request.pickupFromStockist') || 'Pick up from Stockist'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('stockist.request.pickupFromStockistDesc') || 'Collect from a local stockist location.'}
                          </p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : t('stockist.request.submitButton')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
