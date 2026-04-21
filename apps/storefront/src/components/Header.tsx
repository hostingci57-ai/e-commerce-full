'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { useI18n } from '@/lib/i18n-context';
import { LangSwitcher } from './LangSwitcher';
import { api } from '@/lib/api';

interface MenuItem {
  label: string;
  type: 'page' | 'category' | 'url';
  target: string;
}

function toHref(item: MenuItem): string {
  if (item.type === 'page') return `/p/${item.target}`;
  if (item.type === 'category') return `/c/${item.target}`;
  return item.target.startsWith('/') ? item.target : `/${item.target}`;
}

export function Header() {
  const { itemCount } = useCart();
  const { t } = useI18n();
  const [menu, setMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.cms
      .getMenu('main')
      .then((m) => {
        if (!cancelled && m.isActive) setMenu(m.items as MenuItem[]);
      })
      .catch(() => {
        /* ignore — header degrades to defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-brand-700">
            ECF Shop
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          {menu.length > 0 ? (
            menu.map((item, idx) => (
              <Link
                key={`${item.target}-${idx}`}
                href={toHref(item)}
                className="hover:text-brand-700"
              >
                {item.label}
              </Link>
            ))
          ) : (
            <>
              <Link href="/products" className="hover:text-brand-700">
                {t('nav.products')}
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <LangSwitcher />
          <Link
            href="/account/orders"
            className="hidden text-slate-600 hover:text-brand-700 md:inline"
          >
            {t('nav.account')}
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:border-brand-500"
          >
            {t('nav.cart')}
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
