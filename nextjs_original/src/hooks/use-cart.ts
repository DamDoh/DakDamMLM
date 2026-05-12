

'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Product, Commission, Order } from '@/lib/types';
import { addCommission } from '@/services/server-actions';
import { useToast } from './use-toast';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../context/auth-context';

export type { Product };

export interface CartItem {
  product: Product;
  quantity: number;
}

interface UseCartProps {
    initialCartItems?: CartItem[];
    ecashBalance: number;
}

const CART_STORAGE_KEY = 'dakdam_cart';

export function useCart({ initialCartItems = [], ecashBalance }: UseCartProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthContext();

  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
        const storedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
            setCartItems(JSON.parse(storedCart));
        }
    } catch (error) {
        console.error("Failed to load cart from localStorage", error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
        console.error("Failed to save cart to localStorage", error);
    }
  }, [cartItems]);


  const addToCart = (product: Product, quantity: number = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevItems.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prevItems, { product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.product.id !== productId));
  };

  const updateCartItemQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.product.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };
  
  const clearCart = () => {
    setCartItems([]);
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cartItems]);

  const shipping = useMemo(() => (subtotal > 100 ? 0 : 15.00), [subtotal]);
  
  const tax = useMemo(() => subtotal * 0.08, [subtotal]);

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

    setIsLoading(true);
    try {
      const newOrderId = `ORD-${Date.now()}`;
      
      const newOrder: Order = {
        orderId: newOrderId,
        userId: user.id,
        date: new Date().toISOString(),
        status: 'Pending',
        itemCount: itemCount,
        amount: total,
        items: cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          pv: item.product.pv || 0
        }))
      };

      // Use the addOrder function from server-actions
      const { addOrder } = await import('@/services/server-actions');
      await addOrder(user.id, newOrder);

      const transaction: Commission = {
        id: `TRSF-${Date.now()}`,
        userId: user.id,
        date: new Date().toISOString(),
        type: 'E-Cash Purchase',
        status: 'Paid',
        amount: -total,
      };
      await addCommission(transaction);
      
      clearCart();

      router.push(`/checkout/confirmation?orderId=${newOrderId}`);

    } catch (error) {
      console.error("Failed to place order:", error);
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: 'There was an error while placing your order. Please try again.',
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
