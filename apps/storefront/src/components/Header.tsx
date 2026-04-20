'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export function Header() {
  const { itemCount } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-brand-700">
            ECF Shop
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          <Link href="/products" className="hover:text-brand-700">
            Tum Urunler
          </Link>
          <Link href="/c/electronics" className="hover:text-brand-700">
            Elektronik
          </Link>
          <Link href="/c/fashion" className="hover:text-brand-700">
            Moda
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/account/orders"
            className="hidden text-slate-600 hover:text-brand-700 md:inline"
          >
            Hesabim
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:border-brand-500"
          >
            Sepet
            {itemCount > 0 ? (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
