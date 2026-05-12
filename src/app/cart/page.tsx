
'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Trash2, CreditCard, Gift, Truck, Shield, Package } from 'lucide-react';
import { useCartContext } from '@/context/cart-context';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/internationalization';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusIcon, IconWithText, FeatureIcon } from '@/components/ui/icon-library';
import { CheckCircle } from 'lucide-react';
import placeholderData from '@/lib/placeholder-images.json';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

export default function CartPage() {
  const { t } = useI18n();
  const cartContext = useCartContext();
  const router = useRouter();

  if (!cartContext) {
    // Return a proper skeleton loading state
    return (
      <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-end gap-4">
              <Skeleton className="h-6 w-24" />
              <div className="text-right">
                <Skeleton className="h-4 w-12 mb-1" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-16 w-16 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                    <Skeleton className="h-px w-full" />
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cartItems, removeFromCart, updateCartItemQuantity, subtotal, shipping, tax, total, clearCart } = cartContext;

  const handleCheckout = () => {
    router.push('/checkout');
  }

  return (
    <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShoppingCart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {t('cart.title')}
              <Badge variant="secondary" className="ml-2">
                {cartItems.length} {cartItems.length === 1 ? t('cart.item') : t('cart.items')}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('cart.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" icon={Package}>
            <Link href="/product">
              {t('cart.backToProducts')}
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-end gap-4">
            {cartItems.length > 0 && (
              <>
                <StatusIcon
                  status="success"
                  label={`${cartItems.length} items ready`}
                  size="sm"
                />
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(total)}</p>
                </div>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('cart.product')}</TableHead>
                      <TableHead>{t('cart.price')}</TableHead>
                      <TableHead className="text-center">{t('cart.quantity')}</TableHead>
                      <TableHead className="text-right">{t('cart.total')}</TableHead>
                      <TableHead className="text-center">{t('cart.remove')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartItems.length > 0 ? (
                      cartItems.map((item) => {
                        const placeholder = imageMap.get(item.product.imageUrl);
                        // Use the item's unique ID, or generate one if it doesn't exist
                        const uniqueKey = item.id ||
                          (item.shipping?.stockistId
                            ? `${item.product.id}-stockist-${item.shipping.stockistId}`
                            : item.shipping?.addressId
                              ? `${item.product.id}-address-${item.shipping.addressId}`
                              : `${item.product.id}-direct`);
                        return (
                          <TableRow key={uniqueKey}>
                            <TableCell>
                              <div className="flex items-center gap-4">
                                <Image
                                  src={placeholder?.imageUrl || item.product.imageUrl}
                                  alt={item.product.name}
                                  width={64}
                                  height={64}
                                  className="rounded-md object-cover"
                                  {...(placeholder && { 'data-ai-hint': placeholder['data-ai-hint'] })}
                                />
                                <div>
                                  <p className="font-medium">{item.product.name}</p>
                                  <p className="text-sm text-muted-foreground">ID: {item.product.id}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(item.product.price)}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateCartItemQuantity(uniqueKey, parseInt(e.target.value))}
                                className="w-20 mx-auto text-center"
                                min="1"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.product.price * item.quantity)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(uniqueKey)} icon={Trash2}>
                                <span className="sr-only">{t('cart.remove')}</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          {t('cart.empty')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {cartItems.length > 0 && (
                <div className="flex justify-end mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" icon={Trash2}>
                        {t('cart.clearCart')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('cart.clearCart')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('cart.clearCartConfirm')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={clearCart} className="bg-destructive hover:bg-destructive/90">
                          {t('cart.clearCart')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t('cart.orderSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <IconWithText
                      icon={ShoppingCart}
                      text={t('cart.subtotal')}
                      size="sm"
                      color="muted"
                    />
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>


                  <Separator className="my-3" />

                  <div className="flex justify-between items-center font-bold text-base">
                    <IconWithText
                      icon={CreditCard}
                      text={t('cart.orderTotal')}
                      size="default"
                      color="primary"
                    />
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>

                  {/* Savings indicator */}
                  {subtotal > 100 && (
                    <Alert className="mt-3">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {t('cart.savedWithShipping', { amount: formatCurrency((subtotal * 0.1)) })}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={cartItems.length === 0}
                    onClick={handleCheckout}
                    icon={CreditCard}
                  >
                    {t('cart.proceedToCheckout')}
                  </Button>
                </CardFooter>
              </Card>

              {/* Cart benefits */}
              {cartItems.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  <FeatureIcon
                    icon={Truck}
                    title={t('cart.freeShipping')}
                    description={t('cart.freeShippingDescription')}
                    size="sm"
                    color="success"
                  />
                  <FeatureIcon
                    icon={Shield}
                    title={t('cart.secureCheckout')}
                    description={t('cart.secureCheckoutDescription')}
                    size="sm"
                    color="info"
                  />
                  <FeatureIcon
                    icon={Gift}
                    title={t('cart.easyReturns')}
                    description={t('cart.easyReturnsDescription')}
                    size="sm"
                    color="warning"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
