

'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Product, Commission, Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../context/auth-context';

export type { Product };

export interface CartItemShipping {
  shippingOption?: 'direct' | 'stockist';
  addressId?: string;
  stockistId?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  shipping?: CartItemShipping;
  // Unique identifier for this cart item (product + shipping combination)
  id?: string;
}

interface UseCartProps {
    initialCartItems?: CartItem[];
    ecashBalance: number;
}

const CART_STORAGE_KEY = 'dakdam_cart';

export function useCart({ initialCartItems = [], ecashBalance }: UseCartProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthContext();

  // Helper function to generate unique ID for cart item
  const getCartItemId = (product: Product, shipping?: CartItemShipping): string => {
    if (shipping?.stockistId) {
      return `${product.id}-stockist-${shipping.stockistId}`;
    }
    if (shipping?.addressId) {
      return `${product.id}-address-${shipping.addressId}`;
    }
    return `${product.id}-direct`;
  };

  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
        const storedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
            const parsedCart = JSON.parse(storedCart);
            if (Array.isArray(parsedCart) && parsedCart.length > 0) {
                // Ensure all items have unique IDs (for backward compatibility)
                const cartWithIds = parsedCart.map((item: CartItem) => ({
                  ...item,
                  id: item.id || getCartItemId(item.product, item.shipping)
                }));
                setCartItems(cartWithIds);
            }
        }
        setHasLoadedFromStorage(true);
    } catch (error) {
        console.error("Failed to load cart from localStorage", error);
        setHasLoadedFromStorage(true);
    }
  }, []);

  // Save cart to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    // Don't save to localStorage until we've loaded from it first
    // This prevents overwriting the stored cart with empty array on initial mount
    if (!hasLoadedFromStorage) {
        return;
    }
    
    // Don't save empty cart to localStorage - keep the last non-empty cart
    // This prevents clearing the cart during navigation or errors
    if (cartItems.length === 0) {
        return;
    }
    
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
        console.error("Failed to save cart to localStorage", error);
    }
  }, [cartItems, hasLoadedFromStorage]);

  const addToCart = (product: Product, quantity: number = 1, shipping?: CartItemShipping) => {
    setCartItems(prevItems => {
      const itemId = getCartItemId(product, shipping);
      
      // Check if item exists with same product and shipping options
      const existingItem = prevItems.find(item => {
        const existingItemId = item.id || getCartItemId(item.product, item.shipping);
        return existingItemId === itemId;
      });
      
      if (existingItem) {
        // Update quantity of existing item
        return prevItems.map(item => {
          const existingItemId = item.id || getCartItemId(item.product, item.shipping);
          return existingItemId === itemId
            ? { ...item, quantity: item.quantity + quantity, id: itemId }
            : item;
        });
      }
      // Add new item with shipping info and unique ID
      return [...prevItems, { product, quantity, shipping, id: itemId }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prevItems => 
      prevItems.filter(item => {
        const existingItemId = item.id || getCartItemId(item.product, item.shipping);
        return existingItemId !== itemId;
      })
    );
  };

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item => {
        const existingItemId = item.id || getCartItemId(item.product, item.shipping);
        return existingItemId === itemId 
          ? { ...item, quantity: newQuantity } 
          : item;
      })
    );
  };
  
  const clearCart = () => {
    setCartItems([]);
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cartItems]);

  const shipping = useMemo(() => 0, []);
  
  const tax = useMemo(() => 0, []);

  const total = useMemo(() => subtotal + shipping + tax, [subtotal, shipping, tax]);

  const itemCount = useMemo(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  const placeOrder = async () => {
    if (!user) {
       toast({
        variant: 'destructive',
        title: 'Not Authenticated',
        description: 'You must be logged in to place an order.',
      });
      return;
    }

    if (total > ecashBalance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Funds',
        description: 'Your E-Cash balance is not enough to cover this order.',
      });
      return;
    }

    // Validate cart items before proceeding
    // Filter out invalid items instead of clearing entire cart
    const validCartItems = cartItems.filter(
      (item) =>
        item?.product &&
        item.product.id &&
        typeof item.product.price === 'number' &&
        isFinite(item.product.price)
    );

    if (validCartItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cart Error',
        description: 'Your cart is empty or contains invalid items. Please add products again.',
      });
      return;
    }

    // If some items were invalid, update cart with only valid items
    if (validCartItems.length !== cartItems.length) {
      console.warn('Some cart items were invalid and removed:', {
        originalCount: cartItems.length,
        validCount: validCartItems.length,
        removed: cartItems.length - validCartItems.length
      });
      setCartItems(validCartItems);
      toast({
        variant: 'default',
        title: 'Cart Updated',
        description: 'Some invalid items were removed from your cart.',
      });
    }

    setIsLoading(true);
    try {
      // Use validCartItems for the order (always use validated items)
      const itemsToOrder = validCartItems;
      
      // Recalculate totals based on valid items
      const orderSubtotal = itemsToOrder.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const orderShipping = 0;
      const orderTax = 0;
      const orderTotal = orderSubtotal + orderShipping + orderTax;
      
      // Calculate total PV for the order
      const totalPV = itemsToOrder.reduce((sum, item) => {
        const itemPV = (item.product.pv || 0) * item.quantity;
        return sum + itemPV;
      }, 0);

      // Call the API directly to create order and get PV information
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Please log in again to place an order.',
        });
        return;
      }

      // Determine stockistId from cart items (if any item has stockist shipping option)
      // If multiple items have different stockists, use the first one
      const stockistItem = itemsToOrder.find(item => item.shipping?.shippingOption === 'stockist' && item.shipping?.stockistId);
      const stockistId = stockistItem?.shipping?.stockistId || null;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: itemsToOrder.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          totalAmount: orderTotal,
          stockistId: stockistId, // Pass stockistId if buying from stockist
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create order' }));
        
        // Handle validation errors with details
        if (errorData.details && Array.isArray(errorData.details)) {
          const errorMessages = errorData.details.map((err: any) => err.message || err).join(', ');
          throw new Error(errorMessages || errorData.error || 'Failed to create order');
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to create order');
      }

      const result = await response.json();
      const order = result.data?.order || result.order;
      const pvAdded = result.data?.pvAdded || result.pvAdded || totalPV;
      const orderId = order?.orderId || `ORD-${Date.now()}`;
      const ecashReceived = result.data?.ecashReceived || result.ecashReceived || null;

      // Show success toast with PV information
      toast({
        title: 'Order Placed Successfully!',
        description: `You received ${pvAdded.toFixed(0)} PV from this order.`,
        duration: 5000,
      });

      // Note: E-Cash Purchase commission is automatically created by the order API
      // No need to call addCommission here - it's handled server-side
      
      clearCart();

      // Pass ecashReceived info via URL params or localStorage
      const params = new URLSearchParams({ orderId });
      if (ecashReceived) {
        params.set('recipientName', encodeURIComponent(ecashReceived.recipientName || ''));
        params.set('recipientType', ecashReceived.recipientType || '');
        params.set('amount', ecashReceived.amount?.toString() || '0');
      }

      router.push(`/checkout/confirmation?${params.toString()}`);

    } catch (error) {
      console.error("Failed to place order:", error);
      
      // Extract error message
      let errorMessage = 'There was an error while placing your order. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };


  return {
    cartItems,
    setCartItems,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    subtotal,
    shipping,
    tax,
    total,
    itemCount,
    ecashBalance,
    isLoading,
    placeOrder,
  };
}
