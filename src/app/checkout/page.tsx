
'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, Wallet, AlertTriangle, Loader2, CheckCircle, Shield, LayoutDashboard } from 'lucide-react';
import { useCartContext } from '@/context/cart-context';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { StatusIcon, IconWithText } from '@/components/ui/icon-library';
import { useI18n } from '@/lib/internationalization';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import placeholderData from '@/lib/placeholder-images.json';
import { Skeleton } from '@/components/ui/skeleton';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

export default function CheckoutPage() {
  const { t } = useI18n();
  const cartContext = useCartContext();

  if (!cartContext) {
    // Return a proper skeleton loading state
    return (
      <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-4">
                {Array.from({length: 3}).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <Skeleton className="h-6 w-32" />
              <Card className="bg-muted/50">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div>
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-px w-full mb-4" />
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="pt-2">
                      <Skeleton className="h-16 w-full rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Skeleton className="h-10 w-full md:w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  const {
    cartItems,
    total,
    ecashBalance,
    placeOrder,
    isLoading
  } = cartContext;

  const canAfford = total <= ecashBalance;

  if (cartItems.length === 0) {
    return (
      <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 flex items-center justify-center">
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="items-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <CardTitle>{t('checkout.cartEmpty')}</CardTitle>
            <CardDescription>{t('product.noProductsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/product">{t('product.browseCategories')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t('checkout.title')}
                  <Badge variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    {t('checkout.secure')}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {t('checkout.description')}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
                <Button asChild variant="outline" icon={LayoutDashboard}>
                    <Link href="/dashboard">
                        {t('nav.dashboard')}
                    </Link>
                </Button>
                <StatusIcon
                    status={canAfford ? "success" : "error"}
                    label={canAfford ? t('checkout.readyToOrder') : t('checkout.insufficientFunds')}
                    size="sm"
                    className="self-end"
                />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t('checkout.orderSummary')}</h3>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('checkout.product')}</TableHead>
                    <TableHead className="text-right">{t('checkout.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {cartItems.map((item) => {
                        const placeholder = imageMap.get(item.product.imageUrl);
                        return (
                            <TableRow key={item.product.id}>
                                <TableCell>
                                <div className="flex items-center gap-4">
                                    <Image
                                    src={placeholder?.imageUrl || item.product.imageUrl}
                                    alt={item.product.name}
                                    width={48}
                                    height={48}
                                    className="rounded-md object-cover"
                                    {...(placeholder && { 'data-ai-hint': placeholder['data-ai-hint'] })}
                                    />
                                    <div>
                                    <p className="font-medium">{item.product.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.quantity} x {formatCurrency(item.product.price)}
                                    </p>
                                    </div>
                                </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                {formatCurrency(item.product.price * item.quantity)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t('checkout.paymentMethod')}
            </h3>

            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">E-Cash</CardTitle>
                    <p className="text-sm text-muted-foreground">{t('checkout.digitalWallet')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t('checkout.availableBalance')}</p>
                  <p className="font-bold text-lg">{formatCurrency(ecashBalance)}</p>
                </div>
              </CardHeader>
              <CardContent>
                <Separator />
                <div className="space-y-3 text-sm mt-4">
                  <div className="flex justify-between items-center">
                    <IconWithText
                      icon={CreditCard}
                      text={t('checkout.orderTotal')}
                      size="sm"
                      color="muted"
                    />
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>

                  <div className="flex justify-between items-center font-bold text-base">
                    <IconWithText
                      icon={canAfford ? CheckCircle : AlertTriangle}
                      text={t('checkout.remainingBalance')}
                      size="sm"
                      color={canAfford ? "success" : "error"}
                    />
                    <span className={canAfford ? 'text-green-600' : 'text-destructive'}>
                      {formatCurrency(ecashBalance - total)}
                    </span>
                  </div>

                  {/* Balance status */}
                  <div className="pt-2">
                    {canAfford ? (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          {t('checkout.sufficientBalance')}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {t('checkout.insufficientBalance')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            {!canAfford && (
                <Alert variant="destructive">
                    <AlertTitle>{t('checkout.insufficientFundsTitle')}</AlertTitle>
                    <AlertDescription>
                        {t('checkout.insufficientFundsDescription')}
                    </AlertDescription>
                </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
            <Button 
                className="w-full md:w-auto" 
                disabled={!canAfford || isLoading}
                onClick={placeOrder}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('checkout.placingOrder')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('checkout.placeOrder')}
                </>
              )}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
