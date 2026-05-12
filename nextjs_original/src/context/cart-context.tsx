
'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useAuthContext } from './auth-context';
import { ServiceErrorHandler } from '../../services/shared/utils';

// The full return type of the useCart hook
type CartContextType = ReturnType<typeof useCart>;

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { user } = useAuthContext();
  const [ecashBalance, setEcashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setEcashBalance(0);
      return;
    }

    const fetchEcashBalance = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setEcashBalance(0);
          return;
        }

        const response = await fetch('/api/user/ecash-balance', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setEcashBalance(result.data.balance);
          }
        } else {
          console.warn('Failed to fetch ecash balance:', response.statusText);
          setEcashBalance(0);
        }
      } catch (error) {
        console.error('Error fetching ecash balance:', error);
        setEcashBalance(0);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch balance immediately
    fetchEcashBalance();

    // Set up polling for real-time updates (every 30 seconds)
    const interval = setInterval(fetchEcashBalance, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const cartData = useCart({
    initialCartItems: [],
    ecashBalance: ecashBalance
  });

  return (
    <CartContext.Provider value={cartData}>
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw ServiceErrorHandler.createError(
      'CONTEXT_ERROR',
      'useCartContext must be used within a CartProvider'
    );
  }
  return context;
}
