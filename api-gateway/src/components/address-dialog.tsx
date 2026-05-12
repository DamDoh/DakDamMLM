
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { updateMemberAddress } from '@/services/server-actions';
import type { Address } from '@/lib/types';

const addressFormSchema = z.object({
    label: z.string().min(2, "Label is required (e.g., Home, Work)."),
    address: z.string().min(10, "Full address is required."),
    city: z.string().min(2, "City is required."),
    postalCode: z.string().min(3, "Postal code is required."),
    isDefault: z.boolean().default(false),
});

type AddressFormValues = z.infer<typeof addressFormSchema>;

interface AddressDialogProps {
   onSuccess: () => void;
   memberId: string;
   address?: Address | null; // Make address optional for adding new
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
   children?: React.ReactNode; // To use as a trigger
   onAddAddress?: (newAddress: Address) => void;
   onUpdateAddress?: (updatedAddress: Address) => void;
 }

export default function AddressDialog({ onSuccess, memberId, address, isOpen, onOpenChange, children, onAddAddress, onUpdateAddress }: AddressDialogProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = !!address;
    
    const form = useForm<AddressFormValues>({
        resolver: zodResolver(addressFormSchema),
        defaultValues: { label: '', address: '', city: '', postalCode: '', isDefault: false }
    });
    
    useEffect(() => {
        if (isOpen) {
            if (address) {
                form.reset(address);
            } else {
                form.reset({ label: '', address: '', city: '', postalCode: '', isDefault: false });
            }
        }
    }, [isOpen, address, form]);

    const onSubmit = async (values: AddressFormValues) => {
          setIsSaving(true);
          const addressData: Partial<Address> = { ...values };
          if (isEditing && address) {
              addressData.id = address.id;
          }
  
          try {
              const updatedOrNewAddress = await updateMemberAddress(memberId, addressData as Address);
              toast({ title: isEditing ? "Address Updated" : "Address Added", description: `Successfully ${isEditing ? 'updated' : 'added'} your ${values.label} address.` });

              if (!isEditing && onAddAddress) {
                  onAddAddress(updatedOrNewAddress);
              } else if (isEditing && onUpdateAddress) {
                  onUpdateAddress(updatedOrNewAddress);
              } else {
                  onSuccess();
              }
              onOpenChange(false);
          } catch (error) {
              console.error('Address dialog: Error submitting address:', error);
              toast({ variant: 'destructive', title: "Error", description: `Failed to ${isEditing ? 'update' : 'add'} address.` });
          } finally {
              setIsSaving(false);
          }
      };

    const dialogContent = (
         <DialogContent>
             <DialogHeader>
                 <DialogTitle>{isEditing ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                 <DialogDescription>
                     {isEditing ? 'Update your address information.' : 'Add a new shipping or pickup address.'}
                 </DialogDescription>
             </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="label" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Address Label</FormLabel>
                            <FormControl><Input placeholder="e.g., Home, Office" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl><Textarea placeholder="123 Main St, Apt 4B" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem>
                                <FormLabel>City / Province</FormLabel>
                                <FormControl><Input placeholder="Phnom Penh" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="postalCode" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Postal Code</FormLabel>
                                <FormControl><Input placeholder="12000" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <FormField
                        control={form.control}
                        name="isDefault"
                        render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                            <FormLabel>Set as Default</FormLabel>
                            </div>
                            <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                    <DialogFooter>
                       <Button type="submit" disabled={isSaving} icon={isSaving ? "loading" : "save"}>
                           {isEditing ? 'Save Changes' : 'Add Address'}
                       </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );

    if (children) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogTrigger asChild>
                    {children}
                </DialogTrigger>
                {dialogContent}
            </Dialog>
        );
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            {dialogContent}
        </Dialog>
    );
}
