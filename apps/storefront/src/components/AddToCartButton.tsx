'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { useCart } from '@/lib/cart-context';

interface Props {
  variantId: string;
  quantity?: number;
  disabled?: boolean;
  label?: string;
  goToCart?: boolean;
}

export function AddToCartButton({
  variantId,
  quantity = 1,
  disabled,
  label = 'Sepete Ekle',
  goToCart = false,
}: Props) {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await addItem(variantId, quantity);
      if (goToCart) router.push('/cart');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sepete eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        loading={loading}
        size="lg"
      >
        {label}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
