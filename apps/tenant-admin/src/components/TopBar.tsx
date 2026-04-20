'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, User } from 'lucide-react';
import { clearAuth, getUser, type StoredUser } from '@/lib/auth-store';
import { api } from '@/lib/api';

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [user, setUserState] = useState<StoredUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserState(getUser());
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken: '' });
    } catch {
      /* ignore — server-side session may already be invalid */
    }
    clearAuth();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="menü"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm">
          <span className="text-slate-500">Mağaza</span>{' '}
          <span className="font-semibold text-slate-900">
            {user?.tenantId ? user.tenantId.slice(0, 8) : '—'}
          </span>
        </div>
      </div>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <User className="h-4 w-4" />
          <span className="max-w-[160px] truncate">{user?.email ?? '—'}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
        {open ? (
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
              Rol: {user?.roles?.join(', ') || 'Staff'}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
