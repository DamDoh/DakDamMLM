
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
import { Loader2, Send, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Member, Product } from '@/lib/types';
import { requestStockTransfer } from '@/services/server-actions';
import { useI18n } from '@/lib/internationalization';

const requestItemSchema = z.object({
  productId: z.string().min(1, 'Product is required.'),
  productName: z.string(),
  requestedQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
});

const formSchema = z.object({
  requests: z.array(requestItemSchema).min(1, 'You must request at least one product.'),
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
   const [isLoading, setIsLoading] = useState(false);
   const { toast } = useToast();

  const form = useForm<RequestStockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requests: [{ productId: '', productName: '', requestedQuantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "requests"
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({ requests: [{ productId: '', productName: '', requestedQuantity: 1 }] });
    }
  }, [isOpen, form]);

  const onSubmit = async (values: RequestStockFormValues) => {
    setIsLoading(true);
    try {
      if (!stockist.storeOwnerLevel) {
          throw new Error("Only stockists can request transfers.");
      }
      
      const result = await requestStockTransfer({
        stockistId: stockist.id,
        stockistName: stockist.fullName,
        stockistLevel: stockist.storeOwnerLevel,
        requests: values.requests,
      });

      if (result.success) {
        toast({
          title: t('stockist.request.successTitle'),
          description: result.message,
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: t('stockist.request.failedTitle'),
          description: result.message,
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
                        <FormLabel>{t('admin.stock.product')}</FormLabel>
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
                              <SelectValue placeholder={t('admin.stock.selectProduct')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableProducts.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
                onClick={() => append({ productId: '', productName: '', requestedQuantity: 1 })}
                className="w-full"
                icon={PlusCircle}
            >
              {t('stockist.request.addAnother')}
            </Button>
            
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
