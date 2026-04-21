'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';

type SortKey = 'newest' | 'highest' | 'lowest';

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerifiedBuyer: boolean;
  helpfulCount: number;
  createdAt: string;
  authorName: string;
}

interface Stats {
  average: number;
  count: number;
  distribution: Record<string, number>;
}

export function ProductReviews({ productId }: { productId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(
    async (p: number, s: SortKey) => {
      setLoading(true);
      try {
        const [statsRes, listRes] = await Promise.all([
          api.reviews.stats(productId),
          api.reviews.list(productId, { sort: s, page: p, pageSize: 10 }),
        ]);
        setStats(statsRes);
        setItems((prev) => (p === 1 ? listRes.items : [...prev, ...listRes.items]));
        setHasMore(listRes.hasMore);
        setPage(p);
      } finally {
        setLoading(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    void load(1, sort);
  }, [load, sort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.customer.me();
        if (!cancelled) setSignedIn(true);
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxBar = stats
    ? Math.max(1, ...Object.values(stats.distribution).map((v) => Number(v)))
    : 1;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          {stats && stats.count > 0 ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-slate-900">{stats.average.toFixed(1)}</span>
                <StarRow rating={Math.round(stats.average)} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{stats.count} değerlendirme</p>
              <ul className="mt-4 space-y-2">
                {[5, 4, 3, 2, 1].map((n) => {
                  const v = Number(stats.distribution[String(n)] ?? 0);
                  const pct = maxBar === 0 ? 0 : Math.round((v / maxBar) * 100);
                  return (
                    <li key={n} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-6 text-right">{n}★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums">{v}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="text-sm text-slate-500">Henüz değerlendirme yok.</div>
          )}
          <div className="mt-6">
            {signedIn === false ? (
              <Link
                href={`/login?next=${encodeURIComponent(
                  typeof window === 'undefined' ? '/' : window.location.pathname,
                )}`}
                className="inline-block w-full rounded-md border border-brand-600 bg-white px-4 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                Yorum yazmak için giriş yapın
              </Link>
            ) : signedIn === true ? (
              <Button onClick={() => setShowForm(true)} className="w-full">
                Yorum Yaz
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <label className="text-sm text-slate-600">
            Sırala:{' '}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="newest">En yeni</option>
              <option value="highest">En yüksek puan</option>
              <option value="lowest">En düşük puan</option>
            </select>
          </label>
        </div>
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Henüz yorum yok. İlk yorumu siz yazın.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <StarRow rating={r.rating} />
                    <span className="text-sm font-medium text-slate-900">{r.authorName}</span>
                    {r.isVerifiedBuyer ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Doğrulanmış alıcı
                      </span>
                    ) : null}
                  </div>
                  <time className="text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                  </time>
                </div>
                {r.title ? (
                  <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                ) : null}
                {r.comment ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.comment}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.reviews.markHelpful(r.id);
                        setItems((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, helpfulCount: res.helpfulCount } : x)),
                        );
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50"
                  >
                    👍 Faydalı {r.helpfulCount > 0 ? `(${r.helpfulCount})` : ''}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              onClick={() => load(page + 1, sort)}
              disabled={loading}
            >
              Daha fazla yükle
            </Button>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <ReviewForm
          productId={productId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            void load(1, sort);
          }}
        />
      ) : null}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`text-lg leading-none ${n <= rating ? 'text-amber-400' : 'text-slate-300'}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewForm({
  productId,
  onClose,
  onCreated,
}: {
  productId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await api.reviews.create(productId, {
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      const msg =
        e instanceof Error && 'body' in (e as object)
          ? ((e as unknown as { body?: { message?: string } }).body?.message ?? e.message)
          : 'Değerlendirme gönderilemedi';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 lg:col-span-3">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Yorum Yaz</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        <label className="mb-3 block text-sm">
          <span className="text-slate-700">Puan</span>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`text-2xl ${n <= rating ? 'text-amber-400' : 'text-slate-300'}`}
                aria-label={`${n} yıldız`}
              >
                ★
              </button>
            ))}
          </div>
        </label>
        <label className="mb-3 block text-sm">
          <span className="text-slate-700">Başlık (opsiyonel)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="mb-3 block text-sm">
          <span className="text-slate-700">Yorum</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={5000}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            İptal
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Gönderiliyor…' : 'Gönder'}
          </Button>
        </div>
      </div>
    </div>
  );
}
