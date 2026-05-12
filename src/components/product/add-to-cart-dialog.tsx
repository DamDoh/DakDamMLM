
'use client';

import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Minus, Plus, ShoppingCart, Truck, Store } from 'lucide-react';
import Image from 'next/image';
import type { Member, Product, Address } from '@/lib/types';
import { useCartContext } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Label } from '../ui/label';
import { useGenealogyContext } from '@/context/genealogy-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AddressDialog from '@/components/address-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  shippingOption: z.enum(['direct', 'stockist']).default('direct'),
  stockistId: z.string().optional(),
  addressId: z.string().optional(),
}).refine(data => {
  if (data.shippingOption === 'stockist') {
    return !!data.stockistId;
  }
  if (data.shippingOption === 'direct') {
    return !!data.addressId;
  }
  return true;
}, {
  message: 'Please select a shipping/pickup option.',
  path: ['shippingOption'],
});


type AddToCartFormValues = z.infer<typeof formSchema>;

interface AddToCartDialogProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddToCartDialog({ product, isOpen, onOpenChange }: AddToCartDialogProps) {
  const { t } = useI18n();
  const { addToCart } = useCartContext();
  const { allMembersMap, rootMember, refreshMembers } = useGenealogyContext() || { allMembersMap: new Map(), rootMember: null, refreshMembers: async () => {} };
  const { toast } = useToast();
  const router = useRouter();
  // Normalize and validate product image URL for dialog preview
  const rawImageUrl = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
  const hasValidImage = rawImageUrl.length > 0;
  
  const [stockists, setStockists] = useState<Member[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isAddressDialogOpen, setAddressDialogOpen] = useState(false);
  const [stockistSearchOpen, setStockistSearchOpen] = useState(false);
  const [loadingStockists, setLoadingStockists] = useState(false);


  const form = useForm<AddToCartFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      shippingOption: 'direct',
    },
  });

  const shippingOption = useWatch({ control: form.control, name: "shippingOption" });
  const quantity = useWatch({ control: form.control, name: "quantity" });
  
  // Fetch stockists from API and verify they have the product in stock
  const fetchStockists = async () => {
    setLoadingStockists(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token found for fetching stockists');
        setStockists([]);
        return;
      }

      // Fetch all members and filter for stockists
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
      
      // Filter for active stockists (users with storeOwnerLevel S, M, C, D)
      const allStockists = members.filter(
        (m: any) => 
          m.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(m.storeOwnerLevel) &&
          m.active !== false &&
          !m.deleted
      );

      // Check inventory for each stockist to see if they have the product
      const stockistsWithProduct: Member[] = [];
      
      // Check inventory for each stockist in parallel
      const inventoryChecks = await Promise.allSettled(
        allStockists.map(async (stockist: any) => {
          try {
            // Check if this stockist has the product in their inventory
            const inventoryResponse = await fetch(`/api/inventory?userId=${stockist.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (inventoryResponse.ok) {
              const inventoryData = await inventoryResponse.json();
              
              // Handle different response structures
              let inventoryItems: any[] = [];
              if (Array.isArray(inventoryData.data)) {
                inventoryItems = inventoryData.data;
              } else if (inventoryData.data && Array.isArray(inventoryData.data.items)) {
                inventoryItems = inventoryData.data.items;
              } else if (Array.isArray(inventoryData)) {
                inventoryItems = inventoryData;
              }

              // Check if the product exists in their inventory with quantity > 0
              const productInStock = inventoryItems.find(
                (item: any) => item.productId === product.id && item.quantity > 0
              );

              if (productInStock) {
                return stockist;
              }
            }
            return null;
          } catch (error) {
            console.error(`Error checking inventory for stockist ${stockist.id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results (stockists without the product)
      inventoryChecks.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          stockistsWithProduct.push(result.value);
        }
      });
      
      setStockists(stockistsWithProduct);
    } catch (error) {
      console.error('Error fetching stockists:', error);
      setStockists([]);
    } finally {
      setLoadingStockists(false);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
        // Fetch stockists from API
        fetchStockists();
        
        const userAddresses = rootMember?.addresses || [];
        setAddresses(userAddresses);

        const defaultAddress = userAddresses.find(a => a.isDefault) || userAddresses[0];

        form.reset({
            quantity: 1,
            shippingOption: 'direct',
            stockistId: '',
            addressId: defaultAddress?.id,
        });
    }
  }, [isOpen, rootMember, form]);

  const handleAddAddressSuccess = (newAddress: Address) => {
     // Add the new address to the addresses list
     setAddresses(prev => [...prev, newAddress]);
     // Set the new address as selected
     form.setValue('addressId', newAddress.id);
     setAddressDialogOpen(false);
   };

  const handleAddToCart = async (values: AddToCartFormValues) => {
     try {
       // Validate shipping selection
       if (values.shippingOption === 'stockist' && !values.stockistId) {
         toast({
           variant: 'destructive',
           title: 'Stockist Required',
           description: 'Please select a stockist location for pickup.',
         });
         return;
       }
       
       if (values.shippingOption === 'direct' && !values.addressId) {
         toast({
           variant: 'destructive',
           title: 'Address Required',
           description: 'Please select a shipping address.',
         });
         return;
       }

       // Add to cart with shipping information
       addToCart(product, values.quantity, {
         shippingOption: values.shippingOption,
         addressId: values.addressId,
         stockistId: values.stockistId,
       });
       
       toast({
         title: t('product.addedToCart'),
         description: `${values.quantity} x ${product.name} added to your cart.`,
       });
      
      // Close dialog and redirect to cart
       onOpenChange(false);
      router.push('/cart');
     } catch (error) {
       console.error('Error in handleAddToCart:', error);
       toast({
         variant: 'destructive',
         title: 'Error',
         description: 'Failed to add item to cart.',
       });
     }
   };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>
              Select the quantity and shipping method.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddToCart)} className="space-y-6 py-4">
                  <div className="flex items-center gap-4">
                      {hasValidImage ? (
                        <Image
                          src={rawImageUrl}
                          alt={product.name || 'Product image'}
                          width={80}
                          height={80}
                          className="rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center rounded-md bg-muted">
                          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                          {formatCurrency(product.price)}
                      </p>
                      </div>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                      <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => form.setValue('quantity', Math.max(1, (form.getValues('quantity') || 1) - 1))}
                      >
                      <Minus className="h-4 w-4" />
                      </Button>
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-16 text-center"
                                  min="1"
                                  />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                        )}
                      />
                      <span className="text-sm text-muted-foreground">{product.unitType}</span>
                      <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => form.setValue('quantity', (form.getValues('quantity') || 0) + 1)}
                      >
                      <Plus className="h-4 w-4" />
                      </Button>
                  </div>
                  
                  <div>
                    <FormLabel className="text-base font-semibold">Shipping Method</FormLabel>
                    <FormField
                      control={form.control}
                      name="shippingOption"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="mt-2 space-y-2"
                            >
                              <Label
                                htmlFor="direct-shipping"
                                className="flex items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary cursor-pointer"
                              >
                                <RadioGroupItem value="direct" id="direct-shipping" />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <Truck className="h-5 w-5" />
                                    <p className="font-medium">Ship to Address</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Deliver to your default address or specify a new one.
                                  </p>
                                </div>
                              </Label>
                              <Label
                                htmlFor="stockist-pickup"
                                className="flex items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary cursor-pointer"
                              >
                                <RadioGroupItem value="stockist" id="stockist-pickup" />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <Store className="h-5 w-5" />
                                    <p className="font-medium">Pick up from Stockist</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Collect from a local stockist location.
                                    {loadingStockists && (
                                      <span className="ml-2 text-xs">(Checking availability...)</span>
                                    )}
                                    {!loadingStockists && stockists.length === 0 && shippingOption === 'stockist' && (
                                      <span className="ml-2 text-xs text-amber-600">(No stockists with this product available)</span>
                                    )}
                                  </p>
                                </div>
                              </Label>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {shippingOption === 'direct' && (
                    <FormField
                        control={form.control}
                        name="addressId"
                        render={({ field }) => (
                          <FormItem>
                              <FormLabel>Shipping Address</FormLabel>
                              <div className="flex items-center gap-2">
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                      <SelectTrigger>
                                          <SelectValue placeholder="Select a shipping address..." />
                                      </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                          {addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label} - {a.address}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                                  {rootMember && (
                                      <Button type="button" variant="outline" size="icon" aria-label="Add new address" onClick={() => setAddressDialogOpen(true)}>+</Button>
                                  )}
                              </div>
                              <FormMessage />
                          </FormItem>
                        )}
                      />
                  )}

                  {shippingOption === 'stockist' && (
                      <FormField
                        control={form.control}
                        name="stockistId"
                        render={({ field }) => {
                          const selectedStockist = stockists.find(s => s.id === field.value);
                          
                          return (
                            <FormItem className="flex flex-col">
                            <FormLabel>Select Stockist</FormLabel>
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
                                      disabled={loadingStockists}
                                    >
                                      {loadingStockists ? (
                                        "Loading stockists..."
                                      ) : field.value ? (
                                        selectedStockist ? (
                                          (() => {
                                            const fullName = selectedStockist.fullName || `${selectedStockist.firstName || ''} ${selectedStockist.surname || ''}`.trim() || 'Unknown';
                                            const level = selectedStockist.storeOwnerLevel || '';
                                            return `${fullName} • AdminStock${level ? ` (${level})` : ''}`;
                                          })()
                                        ) : (
                                          "Select stockist..."
                                        )
                                      ) : (
                                        "Choose a stockist location..."
                                      )}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                              </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search stockists..." />
                                    <CommandList>
                                      <CommandEmpty>
                                        {loadingStockists 
                                          ? "Checking stock availability..." 
                                          : stockists.length === 0 
                                            ? "No stockists have this product in stock." 
                                            : "No stockists found."}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {stockists.map((stockist) => {
                                          const fullName = stockist.fullName || `${stockist.firstName || ''} ${stockist.surname || ''}`.trim() || 'Unknown';
                                          const level = stockist.storeOwnerLevel || '';
                                          const displayName = `${fullName} • AdminStock${level ? ` (${level})` : ''}`;
                                          
                                          // Get location from addresses (default address first, then first address)
                                          const defaultAddress = stockist.addresses?.find(a => a.isDefault);
                                          const firstAddress = stockist.addresses?.[0];
                                          const address = defaultAddress || firstAddress;
                                          const location = address 
                                            ? `${address.city || ''}${address.city && address.address ? ', ' : ''}${address.address || ''}`.trim()
                                            : stockist.location || '';
                                          
                                          return (
                                            <CommandItem
                                              value={`${fullName} ${level} ${location} ${stockist.memberId || ''}`}
                                              key={stockist.id}
                                              onSelect={() => {
                                                field.onChange(stockist.id);
                                                setStockistSearchOpen(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  field.value === stockist.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span className="font-medium">
                                                  {displayName}
                                                </span>
                                                {location && (
                                                  <span className="text-xs text-muted-foreground">
                                                   {location}
                                                  </span>
                                                )}
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
                          );
                        }}
                      />
                  )}

                  <div className="text-center font-bold text-lg mt-2">
                      Total: {formatCurrency(product.price * (quantity || 1))}
                  </div>
                  
                  <DialogFooter>
                      <Button
                          type="submit"
                          className="w-full"
                          icon={ShoppingCart}
                      >
                          {t('product.addToCart')} ({quantity || 1})
                      </Button>
                  </DialogFooter>
              </form>
          </Form>
        </DialogContent>
      </Dialog>
      {rootMember && (
        <AddressDialog 
          isOpen={isAddressDialogOpen}
          onOpenChange={setAddressDialogOpen}
          onSuccess={() => {}}
          onAddAddress={handleAddAddressSuccess}
          memberId={rootMember.id}
        />
      )}
    </>
  );
}
