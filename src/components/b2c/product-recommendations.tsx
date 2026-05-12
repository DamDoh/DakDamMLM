'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Star,
  TrendingUp,
  Heart,
  Eye,
  Package
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isPopular?: boolean;
  discount?: number;
  reason?: string; // Why this product is recommended
}

interface ProductRecommendationsProps {
  userId?: string;
  limit?: number;
  showReason?: boolean;
}

export function ProductRecommendations({
  userId,
  limit = 6,
  showReason = true
}: ProductRecommendationsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(3);
  const { toast } = useToast();
  const { t } = useI18n();

  // Mock product data - in real app this would come from API
  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Premium Health Supplement',
      price: 89.99,
      imageUrl: '/api/placeholder/200/200',
      category: 'Health & Wellness',
      rating: 4.8,
      reviewCount: 234,
      isPopular: true,
      reason: 'Based on your recent purchases'
    },
    {
      id: '2',
      name: 'Business Starter Kit',
      price: 149.99,
      imageUrl: '/api/placeholder/200/200',
      category: 'Business Tools',
      rating: 4.6,
      reviewCount: 156,
      isNew: true,
      discount: 15,
      reason: 'Trending in your network'
    },
    {
      id: '3',
      name: 'Digital Marketing Course',
      price: 199.99,
      imageUrl: '/api/placeholder/200/200',
      category: 'Education',
      rating: 4.9,
      reviewCount: 89,
      isPopular: true,
      reason: 'Recommended for new members'
    },
    {
      id: '4',
      name: 'Luxury Skincare Set',
      price: 129.99,
      imageUrl: '/api/placeholder/200/200',
      category: 'Beauty & Personal Care',
      rating: 4.7,
      reviewCount: 312,
      reason: 'Popular with similar profiles'
    },
    {
      id: '5',
      name: 'Fitness Equipment Bundle',
      price: 299.99,
      imageUrl: '/api/placeholder/200/200',
      category: 'Sports & Fitness',
      rating: 4.5,
      reviewCount: 178,
      discount: 20,
      reason: 'Based on your interests'
    },
    {
      id: '6',
      name: 'Financial Planning Guide',
      price: 49.99,
      imageUrl: '/api/placeholder/200/200',
      category: 'Books & Guides',
      rating: 4.4,
      reviewCount: 92,
      isNew: true,
      reason: 'Essential for success'
    }
  ];

  useEffect(() => {
    loadRecommendations();
  }, [userId]);

  useEffect(() => {
    const updateItemsPerView = () => {
      if (window.innerWidth < 640) setItemsPerView(1);
      else if (window.innerWidth < 1024) setItemsPerView(2);
      else setItemsPerView(3);
    };

    updateItemsPerView();
    window.addEventListener('resize', updateItemsPerView);
    return () => window.removeEventListener('resize', updateItemsPerView);
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch personalized recommendations
      // For now, we'll simulate loading and use mock data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate personalization based on user behavior
      const personalizedProducts = mockProducts.slice(0, limit);
      setProducts(personalizedProducts);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load product recommendations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentIndex(prev =>
      Math.min(prev + itemsPerView, products.length - itemsPerView)
    );
  };

  const prevSlide = () => {
    setCurrentIndex(prev => Math.max(prev - itemsPerView, 0));
  };

  const addToCart = async (productId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (response.ok) {
        toast({
          title: 'Added to Cart',
          description: 'Product has been added to your cart',
        });
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${
          i < Math.floor(rating)
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex-1">
                <Skeleton className="h-48 w-full mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No product recommendations available at this time
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recommended for You
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Personalized product suggestions based on your activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevSlide}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextSlide}
              disabled={currentIndex >= products.length - itemsPerView}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out gap-4"
            style={{
              transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
              width: `${(products.length / itemsPerView) * 100}%`
            }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                className="flex-1 min-w-0"
                style={{ width: `${100 / itemsPerView}%` }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="relative mb-3">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded-md"
                        onError={(e) => {
                          e.currentTarget.src = '/api/placeholder/200/200';
                        }}
                      />
                      <div className="absolute top-2 left-2 flex gap-1">
                        {product.isNew && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            New
                          </Badge>
                        )}
                        {product.isPopular && (
                          <Badge variant="secondary" className="text-xs">
                            Popular
                          </Badge>
                        )}
                        {product.discount && (
                          <Badge variant="destructive" className="text-xs">
                            -{product.discount}%
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium text-sm line-clamp-2">
                        {product.name}
                      </h3>

                      <div className="flex items-center gap-1">
                        <div className="flex items-center">
                          {renderStars(product.rating)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({product.reviewCount})
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {product.discount ? (
                            <>
                              <span className="text-lg font-bold text-green-600">
                                {formatCurrency(product.price * (1 - product.discount / 100))}
                              </span>
                              <span className="text-sm text-muted-foreground line-through">
                                {formatCurrency(product.price)}
                              </span>
                            </>
                          ) : (
                            <span className="text-lg font-bold">
                              {formatCurrency(product.price)}
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      </div>

                      {showReason && product.reason && (
                        <p className="text-xs text-muted-foreground">
                          <Eye className="h-3 w-3 inline mr-1" />
                          {product.reason}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => addToCart(product.id)}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Add to Cart
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-8 px-3">
                          <Link href={`/product/${product.id}`}>
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination indicators */}
        <div className="flex justify-center mt-4 gap-2">
          {Array.from({ length: Math.ceil(products.length / itemsPerView) }, (_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                Math.floor(currentIndex / itemsPerView) === i
                  ? 'bg-primary'
                  : 'bg-muted-foreground/30'
              }`}
              onClick={() => setCurrentIndex(i * itemsPerView)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\b2c\product-recommendations.tsx