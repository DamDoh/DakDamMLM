
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
  productId: z.string().min(1, 'Please select a product'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
});

// Base form schema - image validation will be handled manually in onSubmit
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
    // Only validate package items if type is package
    if (data.type === 'package') {
      return data.packageItems && data.packageItems.length > 0 && 
             data.packageItems.every(item => item.productId && item.productId.trim() !== '');
    }
    return true;
}, {
    message: 'A package must contain at least one product. Please add items to the package.',
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
  
  // Helper to check if image URL is valid
  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url || url.trim() === '') return false;
    if (url.startsWith('data:image/')) return true;
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    if (url.startsWith('/')) return true;
    return false;
  };
  const [fileName, setFileName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // ~500KB to stay well under the 1MB server action limit

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      originalPrice: 0,
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
          originalPrice: product.originalPrice ?? 0,
            pv: product.pv ?? 0,
      });
      setImagePreview(product.imageUrl);
      setFileName('');
    } else {
      form.reset({
        name: '',
        description: '',
        price: 0,
        originalPrice: 0,
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
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          toast({
            variant: 'destructive',
            title: t('admin.product.imageTooLarge'),
            description: t('admin.product.imageTooLargeDesc'),
          });
          // Clear the file input so user can pick another image
          event.target.value = '';
          return;
        }
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
        } else if (isEditing && product?.imageUrl) {
            // If editing and no new image uploaded, keep existing imageUrl
            finalImageUrl = product.imageUrl;
        }

        // Only require image for new products
        if (!isEditing && !finalImageUrl) {
            toast({ variant: 'destructive', title: t('admin.product.imageRequired'), description: t('admin.product.imageRequiredDesc') });
            setIsLoading(false);
            return;
        }
        
        // Final check - must have imageUrl at this point
        if (!finalImageUrl || !isValidImageUrl(finalImageUrl)) {
            toast({ variant: 'destructive', title: t('admin.product.imageRequired'), description: t('admin.product.imageRequiredValid') });
            setIsLoading(false);
            return;
        }

        // Validate package items if type is package
        if (values.type === 'package') {
          if (!values.packageItems || values.packageItems.length === 0) {
            toast({ 
              variant: 'destructive', 
              title: t('admin.product.packageItemsRequiredTitle'), 
              description: t('admin.product.packageItemsRequiredError')
            });
            setIsLoading(false);
            return;
          }
          
          // Validate each package item has a valid product ID
          const invalidItems = values.packageItems.filter(item => !item.productId || item.productId.trim() === '');
          if (invalidItems.length > 0) {
            toast({ 
              variant: 'destructive', 
              title: t('admin.product.invalidPackageItems'), 
              description: t('admin.product.invalidPackageItemsDesc')
            });
            setIsLoading(false);
            return;
          }
        }

        const productData: Omit<Product, 'id'> = {
            ...values,
            imageUrl: finalImageUrl,
            packageItems: values.type === 'package' ? values.packageItems?.map(p => ({
              ...p, 
              productName: availableProducts.find(ap => ap.id === p.productId)?.name || ''
            })).filter(p => p.productId) : [],
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
                  <FormLabel>{t('admin.product.productType')}</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('admin.product.selectProductType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">{t('admin.product.singleProduct')}</SelectItem>
                        <SelectItem value="package">{t('admin.product.productPackage')}</SelectItem>
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
                           <DollarSign className="h-4 w-4 text-muted-foreground" /> {t('admin.product.promotionalPrice')}
                        </FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" placeholder={t('admin.product.promotionalPricePlaceholder')} {...field} />
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
                    <FormLabel>{t('admin.product.personalVolume')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" placeholder={t('admin.product.personalVolumePlaceholder')} {...field} />
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
                    <FormLabel>{t('admin.product.quantityInStock')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder={t('admin.product.enterQuantity')} {...field} />
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
                    <FormLabel>{t('admin.product.unitType')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('admin.product.selectUnitType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="g">{t('admin.product.unitType.g')}</SelectItem>
                        <SelectItem value="Kg">{t('admin.product.unitType.Kg')}</SelectItem>
                        <SelectItem value="L">{t('admin.product.unitType.L')}</SelectItem>
                        <SelectItem value="ml">{t('admin.product.unitType.ml')}</SelectItem>
                        <SelectItem value="pcs">{t('admin.product.unitType.pcs')}</SelectItem>
                        <SelectItem value="box">{t('admin.product.unitType.box')}</SelectItem>
                        <SelectItem value="pack">{t('admin.product.unitType.pack')}</SelectItem>
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
                           <div>{fileName || (isEditing && t('admin.product.changeImage')) || t('genealogy.chooseFile')}</div>
                         </Button>
                    </div>
                  </FormControl>
                   {imagePreview && isValidImageUrl(imagePreview) && (
                      <div className="mt-2">
                        {imagePreview.startsWith('data:image/') ? (
                          <img
                            src={imagePreview}
                            alt="Image Preview"
                            className="w-24 h-24 object-cover rounded-md border"
                          />
                        ) : (
                          <Image
                            src={imagePreview}
                            alt="Image Preview"
                            width={96}
                            height={96}
                            className="w-24 h-24 object-cover rounded-md border"
                            unoptimized={imagePreview.startsWith('http://') || imagePreview.startsWith('https://')}
                          />
                        )}
                      </div>
                   )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {productType === 'package' && (
              <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium flex items-center gap-2"><Package className="h-5 w-5" /> {t('admin.product.packageItems')}</h3>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                       <FormField
                          control={form.control}
                          name={`packageItems.${index}.productId`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>{t('admin.product.product')}</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('admin.product.selectProduct')} />
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
                              <FormLabel>{t('admin.product.qtyLabel')}</FormLabel>
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
                    icon={PlusCircle}
                    onClick={() => append({ productId: '', quantity: 1 })}
                  >
                    {t('admin.product.addItemToPackage')}
                  </Button>
                  {form.formState.errors.packageItems && (
                    <p className="text-sm text-destructive mt-2">
                      {form.formState.errors.packageItems.message || t('admin.product.packageItemsRequired')}
                    </p>
                  )}
                  {fields.length === 0 && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800 font-medium">
                        ⚠️ {t('admin.product.packageItemsRequiredTitle')}
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {t('admin.product.packageItemsRequiredDesc')}
                      </p>
                    </div>
                  )}
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
