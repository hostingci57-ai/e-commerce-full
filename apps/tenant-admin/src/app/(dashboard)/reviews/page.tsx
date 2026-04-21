'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Eye, ThumbsDown, Trash2 } from 'lucide-react';
import {
  approveReview,
  deleteReview,
  listAdminReviews,
  rejectReview,
  type AdminReview,
  type ReviewStatusValue,
} from '@/lib/queries';
import { Badge, Button, Select } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<ReviewStatusValue, string> = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylı',
  REJECTED: 'Reddedildi',
  SPAM: 'Spam',
};

const STATUS_TONE: Record<ReviewStatusValue, 'slate' | 'green' | 'amber' | 'rose'> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'rose',
  SPAM: 'rose',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'text-amber-500' : 'text-slate-300'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReviewStatusValue | ''>('');
  const [rating, setRating] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const reviewsQ = useQuery({
    queryKey: ['admin-reviews', { status, rating, page }],
    queryFn: () =>
      listAdminReviews({
        status: status || undefined,
        rating: rating || undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveReview(id),
    onSuccess: () => {
      toast.success('Yorum onaylandı');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Onaylama başarısız'),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectReview(id),
    onSuccess: () => {
      toast.success('Yorum reddedildi');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Reddetme başarısız'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      toast.success('Yorum silindi');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Silme başarısız'),
  });

  const columns: Column<AdminReview>[] = [
    {
      key: 'product',
      header: 'Ürün',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.productTitle ?? row.productId}</p>
          <p className="text-xs text-slate-500">{row.customerEmail ?? row.customerName}</p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Puan',
      render: (row) => (
        <div className="flex flex-col">
          <Stars rating={row.rating} />
          <span className="text-xs text-slate-500">{row.rating}/5</span>
        </div>
      ),
      width: '120px',
    },
    {
      key: 'content',
      header: 'Yorum',
      render: (row) => (
        <div className="max-w-md">
          {row.title ? <p className="font-medium text-slate-900">{row.title}</p> : null}
          {row.comment ? (
            <p className="line-clamp-2 text-sm text-slate-600">{row.comment}</p>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
          {row.isVerifiedBuyer ? (
            <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Doğrulanmış alıcı
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
      width: '120px',
    },
    {
      key: 'createdAt',
      header: 'Tarih',
      render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>,
      width: '160px',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/reviews/${row.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" /> Detay
          </Link>
          {row.status !== 'APPROVED' ? (
            <button
              type="button"
              onClick={() => approveMut.mutate(row.id)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
            </button>
          ) : null}
          {row.status !== 'REJECTED' ? (
            <button
              type="button"
              onClick={() => rejectMut.mutate(row.id)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Reddet
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (confirm('Bu yorumu silmek istediğinize emin misiniz?')) {
                deleteMut.mutate(row.id);
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      width: '320px',
    },
  ];

  const data = reviewsQ.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Yorumlar</h1>
          <p className="text-sm text-slate-500">Ürün değerlendirmelerini moderasyondan geçirin.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs text-slate-600">
            Durum
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ReviewStatusValue | '');
                setPage(1);
              }}
              className="mt-1"
            >
              <option value="">Tümü</option>
              <option value="PENDING">Beklemede</option>
              <option value="APPROVED">Onaylı</option>
              <option value="REJECTED">Reddedildi</option>
              <option value="SPAM">Spam</option>
            </Select>
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            Puan
            <Select
              value={rating}
              onChange={(e) => {
                setRating(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="mt-1"
            >
              <option value="">Tümü</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} yıldız
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <DataTable
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        loading={reviewsQ.isLoading}
        empty={<span className="text-sm text-slate-500">Henüz yorum yok.</span>}
        pagination={
          data
            ? {
                page: data.page,
                pageSize: data.pageSize,
                total: data.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </div>
  );
}
