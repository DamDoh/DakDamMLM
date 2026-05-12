'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Heart, Star, Grid, List, LayoutDashboard, PlusCircle, BarChart2, GitBranch, Package } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';
import { useCartContext } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FeatureIcon } from '@/components/ui/icon-library';
import { cn } from '@/lib/utils';
import ProductDialog from '@/components/admin/product-dialog';
import Link from 'next/link';
import { useGenealogyContext } from '@/context/genealogy-context';
import AddToCartDialog from '@/components/product/add-to-cart-dialog';
import RequestProductDialog from '@/components/product/request-product-dialog';
import PurchaseProductDialog from '@/components/product/purchase-product-dialog';
import placeholderData from '@/lib/placeholder-images.json';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/internationalization';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

export default function ProductPage() {
   const { t } = useI18n();
   const [products, setProducts] = useState<Product[]>([]);
   const [loading, setLoading] = useState(true);
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
   const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating'>('name');
   const [favorites, setFavorites] = useState<Set<string>>(new Set());
   const [isProductDialogOpen, setProductDialogOpen] = useState(false);
   const [isAddToCartDialogOpen, setAddToCartDialogOpen] = useState(false);
   const [isRequestStockDialogOpen, setRequestStockDialogOpen] = useState(false);
  const [isPurchaseProductDialogOpen, setPurchaseProductDialogOpen] = useState(false);
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

   const { rootMember } = useGenealogyContext() || { rootMember: null };
   const { toast } = useToast();

   const isAdmin = rootMember?.isAdmin || false;
   const isStockist = !!rootMember?.storeOwnerLevel;
   // Check if user is AdminStock (has storeOwnerLevel S, M, C, or D)
   const isAdminStock = rootMember?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(rootMember.storeOwnerLevel);

   useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const raw = await response.json();
        const fetchedProducts = (raw?.data ?? raw ?? []) as any[];

        const productsWithPlaceholders = fetchedProducts.map((p: any) => {
          const placeholder = imageMap.get(p.imageUrl);
          return {
            ...p,
            imageUrl: placeholder?.imageUrl || p.imageUrl,
            'data-ai-hint': placeholder?.['data-ai-hint'],
          }
        });
        setProducts(productsWithPlaceholders);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
   }, []);
  
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return a.price - b.price;
        case 'rating':
          // Assuming a rating property exists, otherwise this is a placeholder
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });
  }, [products, sortBy]);


  const handleOpenAddToCartDialog = (product: Product) => {
    setSelectedProduct(product);
    setAddToCartDialogOpen(true);
  };
  

  const toggleFavorite = (productId: string) => {
    let willBeFavorite = false;

    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
        willBeFavorite = false;
      } else {
        next.add(productId);
        willBeFavorite = true;
      }
      return next;
    });

    // Show toast after state update decision, outside of the state updater
    if (willBeFavorite) {
      toast({
        title: t('product.addedToFavorites'),
        description: t('product.addedToFavoritesDescription'),
      });
    } else {
      toast({
        title: t('product.removedFromFavorites'),
        description: t('product.removedFromFavoritesDescription'),
      });
    }
  };

  const ProductSkeleton = () => (
    <Card className="flex flex-col">
      <CardHeader className="p-0">
        <Skeleton className="w-full h-48 rounded-t-lg" />
      </CardHeader>
      <CardContent className="p-4 flex-1 flex flex-col">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mt-1" />
        <Skeleton className="h-4 w-5/6 mt-1" />
      </CardContent>
      <CardFooter className="p-4 flex justify-between items-center">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-10 w-32" />
      </CardFooter>
    </Card>
  );

  return (
    <>
      <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('product.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('product.description')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" icon={LayoutDashboard}>
              <Link href="/dashboard">{t('nav.dashboard')}</Link>
            </Button>
            {isAdmin && (
              <Button onClick={() => setProductDialogOpen(true)} icon={PlusCircle}>
                {t('product.addProduct')}
              </Button>
            )}
            {(isStockist || isAdminStock) && (
              <>
              <Button onClick={() => setRequestStockDialogOpen(true)} icon={Package}>
                {t('product.requestProduct.button')}
              </Button>
                <Button onClick={() => setPurchaseProductDialogOpen(true)} icon={ShoppingBag}>
                  {t('product.purchase.button')}
                </Button>
              </>
            )}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                icon={Grid}
                onClick={() => setViewMode('grid')}
              >
                <span className="hidden sm:inline">{t('product.viewGrid')}</span>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                icon={List}
                onClick={() => setViewMode('list')}
              >
                <span className="hidden sm:inline">{t('product.viewList')}</span>
              </Button>
            </div>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'price' | 'rating')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('product.sortByName')}</SelectItem>
                <SelectItem value="price">{t('product.sortByPrice')}</SelectItem>
                <SelectItem value="rating">{t('product.sortByRating')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          <FeatureIcon
            icon={ShoppingBag}
            title={t('product.feature.quality.title')}
            description={t('product.feature.quality.description')}
            color="primary"
          />
          <FeatureIcon
            icon={Heart}
            title={t('product.feature.favorite.title')}
            description={t('product.feature.favorite.description')}
            color="error"
          />
          <FeatureIcon
            icon={Star}
            title={t('product.feature.rated.title')}
            description={t('product.feature.rated.description')}
            color="warning"
          />
        </div>

        <div className={cn(
          "grid gap-6",
          viewMode === 'grid'
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1"
        )}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
          ) : sortedProducts.length > 0 ? (
            sortedProducts.map((product) => {
              const isOnSale = product.originalPrice && product.originalPrice > product.price;
              const imageHint = (product as any)['data-ai-hint'];
              // Normalize and validate image URL once to avoid any empty-string edge cases
              // Helper to validate image URL
              const isValidImageUrl = (url: string | null | undefined): boolean => {
                if (!url || url.trim() === '') return false;
                if (url.startsWith('data:image/')) return true;
                if (url.startsWith('http://') || url.startsWith('https://')) return true;
                if (url.startsWith('/')) return true;
                return false;
              };
              
              const rawImageUrl = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
              const hasValidImage = isValidImageUrl(rawImageUrl);
              return (
                <Card key={product.id} className={cn(
                  "group hover:shadow-lg transition-all duration-200",
                  viewMode === 'list' 
                    ? "flex flex-row" 
                    : "flex flex-col"
                )}>
                  {viewMode === 'list' ? (
                    // List view layout
                    <>
                      <CardHeader className="p-0 flex-shrink-0">
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 overflow-hidden bg-muted">
                          {hasValidImage ? (
                            rawImageUrl.startsWith('data:image/') ? (
                              <img
                                src={rawImageUrl}
                                alt={product.name || t('product.productImageAlt')}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                {...(imageHint && { 'data-ai-hint': imageHint })}
                              />
                            ) : (
                              <Image
                                src={rawImageUrl}
                                alt={product.name || t('product.productImageAlt')}
                                fill
                                style={{ objectFit: 'cover' }}
                                className="group-hover:scale-105 transition-transform duration-200"
                                unoptimized={rawImageUrl.startsWith('http://') || rawImageUrl.startsWith('https://')}
                                {...(imageHint && { 'data-ai-hint': imageHint })}
                              />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}

                          {favorites.has(product.id) && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-red-500 rounded-full p-1">
                                <Heart className="h-4 w-4 text-white fill-current" />
                              </div>
                            </div>
                          )}

                          <div className="absolute top-2 left-2">
                            {isOnSale ? (
                              <Badge variant="destructive">{t('product.saleBadge')}</Badge>
                            ) : (product.qty || 0) > 0 ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                {t('product.inStock')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                                {t('product.outOfStock') || 'Out of Stock'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <div className="flex-1 flex flex-col">
                        <CardContent className="p-4 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                            <CardTitle className="text-xl leading-tight">{product.name}</CardTitle>
                          </div>
                          <CardDescription className="text-sm line-clamp-2 mb-4">
                            {product.description}
                          </CardDescription>

                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">{t('product.pvLabel')}</span>
                                <span className="text-base font-semibold text-primary">{product.pv || 0}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">{t('product.quantityInStockLabel')}</span>
                                <span className={cn(
                                  "text-base font-semibold",
                                  (product.qty || 0) > 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {product.qty || 0}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0">
                              <p className="text-2xl font-bold">
                                {formatCurrency(product.price)}
                              </p>
                              {isOnSale && (
                                <p className="text-sm text-muted-foreground line-through">
                                  {formatCurrency(product.originalPrice!)}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>

                        <CardFooter className="p-4 pt-0">
                          <div className="flex items-center justify-end gap-2 w-full">
                            {isAdmin ? (
                              <Button asChild size="default">
                                <Link href={`/admin/products`}>
                                  <BarChart2 className="mr-2 h-4 w-4" />
                                  {t('product.manageStock')}
                                </Link>
                              </Button>
                            ) : isStockist ? (
                              // Stockists see no buttons on product cards - they use the top "Request Stock" button
                              null
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="default"
                                  icon={Heart}
                                  onClick={() => toggleFavorite(product.id)}
                                >
                                  {t(favorites.has(product.id) ? 'product.favorited' : 'product.favorite')}
                                </Button>
                                <Button
                                  onClick={() => handleOpenAddToCartDialog(product)}
                                  size="default"
                                  icon={PlusCircle}
                                  disabled={(product.qty || 0) === 0}
                                >
                                  {t('product.addToCart')}
                                </Button>
                              </>
                            )}
                          </div>
                        </CardFooter>
                      </div>
                    </>
                  ) : (
                    // Grid view layout
                    <>
                      <CardHeader className="p-0">
                        <div className="relative w-full h-48 overflow-hidden bg-muted">
                          {hasValidImage ? (
                            rawImageUrl.startsWith('data:image/') ? (
                              <img
                                src={rawImageUrl}
                                alt={product.name || t('product.productImageAlt')}
                                className="w-full h-full object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-200"
                                {...(imageHint && { 'data-ai-hint': imageHint })}
                              />
                            ) : (
                              <Image
                                src={rawImageUrl}
                                alt={product.name || t('product.productImageAlt')}
                                fill
                                style={{ objectFit: 'cover' }}
                                className="rounded-t-lg group-hover:scale-105 transition-transform duration-200"
                                unoptimized={rawImageUrl.startsWith('http://') || rawImageUrl.startsWith('https://')}
                                {...(imageHint && { 'data-ai-hint': imageHint })}
                              />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted rounded-t-lg">
                              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}

                          {favorites.has(product.id) && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-red-500 rounded-full p-1">
                                <Heart className="h-4 w-4 text-white fill-current" />
                              </div>
                            </div>
                          )}

                          <div className="absolute top-2 left-2">
                            {isOnSale ? (
                              <Badge variant="destructive">{t('product.saleBadge')}</Badge>
                            ) : (product.qty || 0) > 0 ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                {t('product.inStock')} ({product.qty || 0})
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                                {t('product.outOfStock') || 'Out of Stock'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                        </div>
                        <CardDescription className="text-sm line-clamp-3 mb-3 flex-1">
                          {product.description}
                        </CardDescription>

                        <div className="flex items-center justify-between mb-3 gap-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">{t('product.pvLabel')}</span>
                              <span className="text-sm font-semibold text-primary">{product.pv || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">{t('product.quantityInStockLabel')}</span>
                              <span className={cn(
                                "text-sm font-semibold",
                                (product.qty || 0) > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {product.qty || 0}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <p className="text-xl font-bold">
                              {formatCurrency(product.price)}
                            </p>
                            {isOnSale && (
                              <p className="text-sm text-muted-foreground line-through">
                                {formatCurrency(product.originalPrice!)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="p-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
                          {isAdmin ? (
                            <Button asChild size="default" className="flex-1">
                              <Link href={`/admin/products`}>
                                <BarChart2 className="mr-2 h-4 w-4" />
                                Manage Stock
                              </Link>
                            </Button>
                          ) : isStockist ? (
                            // Stockists see no buttons on product cards - they use the top "Request Stock" button
                            null
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="default"
                                icon={Heart}
                                onClick={() => toggleFavorite(product.id)}
                              >
                                {t(favorites.has(product.id) ? 'product.favorited' : 'product.favorite')}
                              </Button>
                              <Button
                                onClick={() => handleOpenAddToCartDialog(product)}
                                size="default"
                                icon={PlusCircle}
                                className="flex-1"
                                disabled={(product.qty || 0) === 0}
                              >
                                {t('product.addToCart')}
                              </Button>
                            </>
                          )}
                        </div>
                      </CardFooter>
                    </>
                  )}
                </Card>
              )
          })
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="max-w-md mx-auto">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('product.noProducts')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('product.noProductsDescription')}
                </p>
                <Button variant="outline" icon={ShoppingBag}>
                  {t('product.browseCategories')}
                </Button>
              </div>
            </div>
          )}
        </div>
        <ProductDialog
          isOpen={isProductDialogOpen}
          onOpenChange={setProductDialogOpen}
          onSuccess={() => {}}
          product={null}
        />
      </div>

      {selectedProduct && (
        <AddToCartDialog
          product={selectedProduct}
          isOpen={isAddToCartDialogOpen}
          onOpenChange={setAddToCartDialogOpen}
        />
      )}
      {rootMember && (isStockist || isAdminStock) && (
        <>
        <RequestProductDialog
          isOpen={isRequestStockDialogOpen}
          onOpenChange={setRequestStockDialogOpen}
          stockist={rootMember}
          availableProducts={products}
        />
          <PurchaseProductDialog
            isOpen={isPurchaseProductDialogOpen}
            onOpenChange={setPurchaseProductDialogOpen}
            stockist={rootMember}
            availableProducts={products}
          />
        </>
      )}
    </>
  );
}
