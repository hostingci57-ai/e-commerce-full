'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { formatPrice } from '@/lib/format';

interface WishlistEntry {
  productId: string;
  variantId: string | null;
  addedAt: string;
  product: {
    id: string;
    slug: string;
    title: string;
    status: string;
    brand: { id: string; name: string } | null;
    priceMinor: string | null;
    compareAtMinor: string | null;
    currency: string | null;
    inStock: boolean;
    defaultVariantId: string | null;
    image: { id: string; url: string; key: string } | null;
  } | null;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveResult, setMoveResult] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const res = await api.wishlist.list();
      setItems(res);
    } catch (e) {
      setError(
        e instanceof Error && 'status' in (e as object)
          ? 'Önce giriş yapmalısınız'
          : 'Favoriler yüklenemedi',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(productId: string): Promise<void> {
    setBusy(productId);
    try {
      await api.wishlist.remove(productId);
      setItems((prev) => (prev ?? []).filter((x) => x.productId !== productId));
    } finally {
      setBusy(null);
    }
  }

  async function addToCart(entry: WishlistEntry): Promise<void> {
    const variantId = entry.variantId ?? entry.product?.defaultVariantId;
    if (!variantId) return;
    setBusy(entry.productId);
    try {
      await api.cart.addItem({ variantId, quantity: 1 });
      await api.wishlist.remove(entry.productId);
      setItems((prev) => (prev ?? []).filter((x) => x.productId !== entry.productId));
    } finally {
      setBusy(null);
    }
  }

  async function moveAll(): Promise<void> {
    setMoveBusy(true);
    try {
      const res = await api.wishlist.moveToCart();
      setMoveResult(
        res.skipped.length > 0
          ? `${res.moved} ürün sepete eklendi, ${res.skipped.length} ürün atlandı.`
          : `${res.moved} ürün sepete eklendi.`,
      );
      await load();
    } catch {
      setMoveResult('Taşıma başarısız');
    } finally {
      setMoveBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        {error}{' '}
        <Link href="/login" className="text-brand-700 hover:underline">
          Giriş Yap
        </Link>
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Favori listeniz boş. İlgilendiğiniz ürünleri kalp ikonu ile kaydedin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{items.length} ürün</p>
        <Button onClick={moveAll} disabled={moveBusy}>
          {moveBusy ? 'Taşınıyor…' : 'Tümünü Sepete Ekle'}
        </Button>
      </div>
      {moveResult ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {moveResult}
        </div>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((entry) => {
          const p = entry.product;
          const price = p?.priceMinor ? Number(p.priceMinor) : null;
          const compareAt = p?.compareAtMinor ? Number(p.compareAtMinor) : null;
          return (
            <li
              key={entry.productId}
              className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <Link
                href={p ? `/products/${p.slug}` : '#'}
                className="aspect-square w-full overflow-hidden bg-slate-100"
              >
                {p?.image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image.url}
                    alt={p.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    Görsel Yok
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-3">
                {p?.brand ? (
                  <span className="text-xs text-slate-500">{p.brand.name}</span>
                ) : null}
                <h3 className="line-clamp-2 text-sm font-medium text-slate-900">
                  {p?.title ?? 'Ürün kaldırıldı'}
                </h3>
                {price !== null && p?.currency ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-semibold text-slate-900">
                      {formatPrice(price, p.currency)}
                    </span>
                    {compareAt && compareAt > price ? (
                      <span className="text-xs text-slate-400 line-through">
                        {formatPrice(compareAt, p.currency)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {p && !p.inStock ? (
                  <span className="text-xs font-medium text-red-600">Stokta Yok</span>
                ) : null}
                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => addToCart(entry)}
                    disabled={!p?.inStock || busy === entry.productId}
                  >
                    Sepete Ekle
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => remove(entry.productId)}
                    disabled={busy === entry.productId}
                  >
                    Kaldır
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
