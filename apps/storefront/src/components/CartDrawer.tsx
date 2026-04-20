'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { CartLineItem } from './CartLineItem';
import { Button } from './Button';

/**
 * Compact cart drawer (not currently mounted globally; available for
 * future header integration). Uses the same cart-context as /cart.
 */
export function CartDrawer({ onClose }: { onClose?: () => void }) {
  const { cart } = useCart();
  if (!cart) return null;
  const currency = cart.totals.currency;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold">Sepet</h2>
        <button onClick={onClose} aria-label="Kapat" className="text-slate-500">
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4">
        {cart.lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Sepet bos.</p>
        ) : (
          cart.lines.map((l) => (
            <CartLineItem key={l.variantId} line={l} currency={currency} />
          ))
        )}
      </div>
      <footer className="border-t border-slate-200 p-4">
        <div className="mb-3 flex justify-between text-sm">
          <span>Ara Toplam</span>
          <span className="font-semibold">
            {formatPrice(cart.totals.subtotal, currency)}
          </span>
        </div>
        <Link href="/cart" className="block">
          <Button className="w-full" size="lg">
            Sepete Git
          </Button>
        </Link>
      </footer>
    </div>
  );
}
