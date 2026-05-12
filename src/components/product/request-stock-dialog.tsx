'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import { Loader2, MapPin, Store, Package } from 'lucide-react';
import type { Product } from '@/lib/types';

interface RequestStockDialogProps {
  product: Product | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function RequestStockDialog({ product, isOpen, onOpenChange, onSuccess }: RequestStockDialogProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuthContext();
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [shippingMethod, setShippingMethod] = useState<'ship_to_address' | 'pickup_from_stockist'>('pickup_from_stockist');
  const [loading, setLoading] = useState(false);

  // Check if user is AdminStock (S, M, C, D)
  const isAdminStock = user?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(user.storeOwnerLevel);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) return;
    
    if (quantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Quantity',
        description: 'Please enter a quantity greater than 0',
      });
      return;
    }

    // Only AdminStock can request products
    if (!isAdminStock) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only AdminStock members can request products.',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Store request data in sessionStorage and redirect to Binary Stock for target selection
      const requestData = {
        requests: [{
          productId: product.id,
          productName: product.name,
          requestedQuantity: quantity,
          unitPrice: product.price || 0,
        }],
        shippingMethod: shippingMethod,
        requesterId: user?.id,
        requesterName: user?.fullName || '',
        requesterLevel: user?.storeOwnerLevel || 'S',
        notes: notes.trim() || undefined,
      };
      
      sessionStorage.setItem('pendingStockRequest', JSON.stringify(requestData));
      
      toast({
        title: t('stockist.request.selectTargetTitle') || 'Select Target AdminStock',
        description: t('stockist.request.selectTargetDesc') || 'Please select an AdminStock from the binary tree to send your request.',
      });
      
      // Reset form and close dialog
      setQuantity(1);
      setNotes('');
      setShippingMethod('pickup_from_stockist');
      onOpenChange(false);
      
      // Redirect to Binary Stock page with selection mode
      router.push('/binary-stock?selectTarget=true');
      
    } catch (error: any) {
      console.error('Failed to submit stock request:', error);
      toast({
        variant: 'destructive',
        title: 'Request Failed',
        description: error.message || 'Failed to submit stock request. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setQuantity(1);
      setNotes('');
      setShippingMethod('pickup_from_stockist');
      onOpenChange(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('product.requestProduct.title') || 'Request Product'}
          </DialogTitle>
          <DialogDescription>
            {t('product.requestProduct.description') || 'Request products from the product catalog. All requested items will be included in one invoice.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('product.requestProduct.product') || 'Product'}</Label>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{product.name}</p>
                {product.description && (
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">{t('admin.product.qty') || 'Qty'}</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                placeholder="Enter quantity"
                required
                disabled={loading}
                className="w-24"
              />
            </div>

            {/* Shipping Method Section */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-base font-semibold">
                {t('stockist.request.shippingMethod') || 'Shipping Method'}
              </Label>
              <RadioGroup
                value={shippingMethod}
                onValueChange={(value) => setShippingMethod(value as 'ship_to_address' | 'pickup_from_stockist')}
                className="flex flex-col space-y-2"
                disabled={loading}
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
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('stockist.request.submitButton') || 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
