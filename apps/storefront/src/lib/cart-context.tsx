'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { Cart } from './types';

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: (code: string) => Promise<void>;
  itemCount: number;
}

const EMPTY_CART: Cart = {
  lines: [],
  totals: {
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    currency: 'TRY',
  },
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.cart.get();
      setCart(next ?? EMPTY_CART);
    } catch (e) {
      // On first visit backend creates a guest cart; errors are non-fatal
      setCart(EMPTY_CART);
      setError(e instanceof Error ? e.message : 'cart_fetch_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      const next = await api.cart.addItem({ variantId, quantity });
      setCart(next);
    },
    [],
  );

  const updateItem = useCallback(
    async (variantId: string, quantity: number) => {
      const next = await api.cart.updateItem(variantId, quantity);
      setCart(next);
    },
    [],
  );

  const removeItem = useCallback(async (variantId: string) => {
    const next = await api.cart.removeItem(variantId);
    setCart(next);
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    const next = await api.cart.applyCoupon(code);
    setCart(next);
  }, []);

  const removeCoupon = useCallback(async (code: string) => {
    const next = await api.cart.removeCoupon(code);
    setCart(next);
  }, []);

  const itemCount = useMemo(
    () => cart?.lines.reduce((acc, l) => acc + l.quantity, 0) ?? 0,
    [cart],
  );

  const value: CartContextValue = {
    cart,
    loading,
    error,
    refresh,
    addItem,
    updateItem,
    removeItem,
    applyCoupon,
    removeCoupon,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
