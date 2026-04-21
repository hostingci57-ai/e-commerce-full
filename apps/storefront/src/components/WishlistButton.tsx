'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { api } from '@/lib/api';

/**
 * Heart toggle rendered on product cards + PDP. Two responsibilities:
 *   1) When clicked as a guest, route to /login?next=... (wishlist is member-only).
 *   2) When clicked as a member, POST → add or DELETE → remove, flipping the heart.
 *
 * The component is deliberately optimistic — we flip the icon immediately and
 * roll back on error. Keeps the interaction snappy on the storefront.
 */
export function WishlistButton({
  productId,
  variantId,
  initiallyActive,
  className = '',
  size = 'md',
}: {
  productId: string;
  variantId?: string | null;
  initiallyActive?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [active, setActive] = useState<boolean>(Boolean(initiallyActive));
  const [busy, setBusy] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.customer.me();
        if (!cancelled) setSignedIn(true);
      } catch {
        if (!cancelled) setSignedIn(false);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(e: MouseEvent): Promise<void> {
    // ProductCard wraps the heart in a <Link>; don't navigate when toggling.
    e.preventDefault();
    e.stopPropagation();
    if (!authChecked) return;
    if (!signedIn) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/login?next=${next}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const prev = active;
    setActive(!prev);
    try {
      if (prev) {
        await api.wishlist.remove(productId);
      } else {
        await api.wishlist.add(productId, variantId ?? undefined);
      }
    } catch {
      setActive(prev);
    } finally {
      setBusy(false);
    }
  }

  const dims = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      className={`inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300 ${dims} ${className}`}
      disabled={busy}
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={`${icon} ${active ? 'fill-rose-500 stroke-rose-500' : 'fill-none stroke-current'}`}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
