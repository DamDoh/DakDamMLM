
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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Label } from '../ui/label';
import { useGenealogyContext } from '@/context/genealogy-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AddressDialog from '@/components/address-dialog';

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
  const { allMembersMap, rootMember } = useGenealogyContext() || { allMembersMap: new Map(), rootMember: null };
  const { toast } = useToast();
  
  const [stockists, setStockists] = useState<Member[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isAddressDialogOpen, setAddressDialogOpen] = useState(false);


  const form = useForm<AddToCartFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      shippingOption: 'direct',
    },
  });

  const shippingOption = useWatch({ control: form.control, name: "shippingOption" });
  const quantity = useWatch({ control: form.control, name: "quantity" });
  
  useEffect(() => {
    if (isOpen) {
        const availableStockists = Array.from(allMembersMap.values()).filter(m => m.storeOwnerLevel);
        setStockists(availableStockists);
        
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
  }, [isOpen, allMembersMap, rootMember, form]);

  const handleAddAddressSuccess = () => {
     // Refresh root member data if needed
     setAddressDialogOpen(false);
   };

  const handleAddToCart = (values: AddToCartFormValues) => {
     try {
       addToCart(product, values.quantity);
       toast({
         title: t('product.addedToCart'),
         description: `${values.quantity} x ${product.name} added to your cart.`,
       });
       onOpenChange(false);
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
                      <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={80}
                      height={80}
                      className="rounded-md object-cover"
                      />
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
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Stockist</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a stockist location..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {stockists.map(s => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.fullName} ({s.location || s.rank})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
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
          onSuccess={handleAddAddressSuccess}
          memberId={rootMember.id}
        />
      )}
    </>
  );
}
