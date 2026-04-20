'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Building2, Package, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { clearToken, getEmail, isAuthenticated } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Building2;
}

const NAV: NavItem[] = [
  { href: '/tenants', label: 'Tenantlar', icon: Building2 },
  { href: '/plans', label: 'Paketler', icon: Package },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setEmail(getEmail());
    setReady(true);
  }, [router]);

  if (!ready) return null;

  function onLogout(): void {
    clearToken();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          <span className="text-sm font-semibold text-gray-900">Landlord</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  active ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <div className="mb-2 truncate px-2 text-xs text-gray-500">{email ?? 'landlord'}</div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4" />
            Çıkış yap
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
