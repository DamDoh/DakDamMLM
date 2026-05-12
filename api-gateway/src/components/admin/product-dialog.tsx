
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, PlusCircle, Upload, Package, Trash2, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { addProduct, updateProduct } from '@/services/product-service';
import { useI18n } from '@/lib/internationalization';
import Image from 'next/image';



const packageItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().min(1),
});

const formSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  price: z.coerce.number().positive('Price must be a positive number.'),
  originalPrice: z.coerce.number().optional(),
  pv: z.coerce.number().min(0, 'PV must be 0 or greater.'),
  qty: z.coerce.number().min(0, 'Quantity must be 0 or greater.'),
  unitType: z.string().min(1, 'Unit type is required.'),
  image: z.any().optional(),
  imageUrl: z.string().optional(),
  type: z.enum(['single', 'package']).default('single'),
  packageItems: z.array(packageItemSchema).optional(),
}).refine(data => {
    // If editing (imageUrl exists) and no new image is uploaded, it's valid.
    // If creating, either image or imageUrl (if we were to support external URLs) must be present.
    return !!data.imageUrl || (data.image && data.image.length > 0);
}, {
    message: 'An image is required.',
    path: ['image'],
}).refine(data => data.type !== 'package' || (data.packageItems && data.packageItems.length > 0), {
    message: 'A package must contain at least one product.',
    path: ['packageItems'],
});


type ProductFormValues = z.infer<typeof formSchema>;

interface ProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

export default function ProductDialog({ isOpen, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const { toast } = useToast();
  const isEditing = !!product;
  const [fileName, setFileName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      originalPrice: undefined,
      pv: 0,
      qty: 0,
      unitType: '',
      imageUrl: '',
      type: 'single',
      packageItems: [],
    },
  });
  
  const productType = useWatch({ control: form.control, name: 'type' });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'packageItems',
  });

  useEffect(() => {
    if (isOpen) {
      const fetchAvailableProducts = async () => {
        try {
          const res = await fetch('/api/products?limit=100&offset=0');
          if (!res.ok) throw new Error('Failed to fetch products');
          const data = await res.json();
          const products = (data?.data || data?.items || []) as Product[];
          const singles = products.filter((p: any) => p.type === 'single');
          setAvailableProducts(singles);
        } catch (error) {
          console.error('Failed to fetch available products:', error);
        }
      };
      fetchAvailableProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (product) {
      form.reset({
          ...product,
          packageItems: product.packageItems || [],
          originalPrice: product.originalPrice || undefined,
            pv: product.pv ?? 0,
      });
      setImagePreview(product.imageUrl);
      setFileName('');
    } else {
      form.reset({
        name: '',
        description: '',
        price: 0,
        originalPrice: undefined,
            pv: 0,
        qty: 0,
        unitType: '',
        imageUrl: '',
        type: 'single',
        packageItems: [],
      });
      setImagePreview(null);
      setFileName('');
    }
  }, [product, form, isOpen]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        form.setValue('image', event.target.files);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  }

  const onSubmit = async (values: ProductFormValues) => {
    setIsLoading(true);
    try {
        const file = values.image?.[0];
        let finalImageUrl = values.imageUrl;

        if (file) {
            const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
            finalImageUrl = await toBase64(file);
        }

        if (!finalImageUrl) {
            toast({ variant: 'destructive', title: 'Image Required', description: 'Please select an image for the product.' });
            setIsLoading(false);
            return;
        }

        const productData: Omit<Product, 'id'> = {
            ...values,
            imageUrl: finalImageUrl,
            packageItems: values.type === 'package' ? values.packageItems?.map(p => ({...p, productName: availableProducts.find(ap => ap.id === p.productId)?.name || ''})) : [],
            originalPrice: values.originalPrice || 0,
            category: (product as Product | null)?.category ?? 'General',
            isActive: (product as Product | null)?.isActive ?? true,
        };

      if (isEditing && product) {
        await updateProduct(product.id, productData);
        toast({ title: t('admin.product.updateSuccess'), description: t('admin.product.updateSuccessDesc', { name: values.name }) });
      } else {
        await addProduct(productData);
        toast({ title: t('admin.product.addSuccess'), description: t('admin.product.addSuccessDesc', { name: values.name }) });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: t('admin.product.operationFailed'),
        description: t('admin.product.operationFailedDesc', { operation: isEditing ? 'update' : 'add' }),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Save /> : <PlusCircle />}
            {isEditing ? t('admin.product.editTitle') : t('admin.product.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('admin.product.editDescription') : t('admin.product.addDescription')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Type</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single Product</SelectItem>
                        <SelectItem value="package">Product Package</SelectItem>
                      </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.product.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.product.namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.product.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('admin.product.descriptionPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('admin.product.priceLabel')}</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" placeholder={t('admin.product.pricePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="originalPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2">
                           <DollarSign className="h-4 w-4 text-muted-foreground" /> Promotional Price (Optional)
                        </FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 99.99" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="pv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Volume (PV)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" placeholder="e.g., 40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity in Stock</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="Enter quantity" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="g">g (grams)</SelectItem>
                        <SelectItem value="Kg">Kg (kilograms)</SelectItem>
                        <SelectItem value="L">L (liters)</SelectItem>
                        <SelectItem value="ml">ml (milliliters)</SelectItem>
                        <SelectItem value="pcs">pcs (pieces)</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                        <SelectItem value="pack">pack</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Upload className="h-4 w-4" /> {t('admin.product.image')}</FormLabel>
                  <FormControl>
                     <div className="relative">
                        <Input 
                            id="image-upload" 
                            type="file" 
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleImageChange}
                        />
                         <Button asChild variant="outline" className="w-full">
                           <div>{fileName || (isEditing && 'Change Image') || t('genealogy.chooseFile')}</div>
                         </Button>
                    </div>
                  </FormControl>
                   {imagePreview && (
                      <div className="mt-2">
                        <Image src={imagePreview} alt="Image Preview" width={96} height={96} className="w-24 h-24 object-cover rounded-md border" />
                      </div>
                   )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {productType === 'package' && (
              <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium flex items-center gap-2"><Package className="h-5 w-5" /> Package Items</h3>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                       <FormField
                          control={form.control}
                          name={`packageItems.${index}.productId`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Product</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a product" />
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
                          name={`packageItems.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Qty</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} className="w-20" />
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ productId: '', quantity: 1 })}
                  >
                    Add Item to Package
                  </Button>
                   <FormMessage>{form.formState.errors.packageItems?.message}</FormMessage>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : (isEditing ? t('common.save') : t('product.addProduct'))}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
