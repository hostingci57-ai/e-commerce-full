'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  BarChart3,
  Box,
  Layers,
  Package,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Gösterge Paneli', icon: BarChart3 },
  { href: '/products', label: 'Ürünler', icon: Package },
  { href: '/categories', label: 'Kategoriler', icon: Layers },
  { href: '/brands', label: 'Markalar', icon: Tag },
  { href: '/orders', label: 'Siparişler', icon: ShoppingCart },
  { href: '/customers', label: 'Müşteriler', icon: Users },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-200 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-base font-semibold text-white"
          >
            <Box className="h-5 w-5 text-brand-500" />
            <span>Tenant Admin</span>
          </Link>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-1 text-slate-300 hover:bg-slate-800 lg:hidden"
            aria-label="close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={clsx(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                      active
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
          v0.1.0
        </div>
      </aside>
    </>
  );
}
