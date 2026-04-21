'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ThumbsDown, Trash2 } from 'lucide-react';
import {
  approveReview,
  deleteReview,
  getAdminReview,
  rejectReview,
} from '@/lib/queries';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id as string;

  const reviewQ = useQuery({
    queryKey: ['admin-review', id],
    queryFn: () => getAdminReview(id),
    enabled: !!id,
  });

  const approveMut = useMutation({
    mutationFn: () => approveReview(id),
    onSuccess: () => {
      toast.success('Onaylandı');
      qc.invalidateQueries({ queryKey: ['admin-review', id] });
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });
  const rejectMut = useMutation({
    mutationFn: () => rejectReview(id),
    onSuccess: () => {
      toast.success('Reddedildi');
      qc.invalidateQueries({ queryKey: ['admin-review', id] });
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteReview(id),
    onSuccess: () => {
      toast.success('Silindi');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      router.push('/reviews');
    },
  });

  if (reviewQ.isLoading) return <div className="p-6 text-slate-500">Yükleniyor…</div>;
  const review = reviewQ.data;
  if (!review) return <div className="p-6 text-slate-500">Yorum bulunamadı</div>;

  return (
    <div className="space-y-4">
      <Link
        href="/reviews"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Tüm yorumlar
      </Link>
      <Card>
        <CardHeader
          title="Yorum Detayı"
          action={
            <Badge
              tone={
                review.status === 'APPROVED'
                  ? 'green'
                  : review.status === 'REJECTED' || review.status === 'SPAM'
                    ? 'rose'
                    : 'amber'
              }
            >
              {review.status}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Ürün</p>
              <p className="font-medium text-slate-900">{review.product?.title ?? review.productId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Müşteri</p>
              <p className="font-medium text-slate-900">{review.customer?.name ?? review.customerName}</p>
              <p className="text-xs text-slate-500">{review.customer?.email ?? review.customerEmail}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Puan</p>
              <p className="text-lg">
                <span className="text-amber-500">{'★'.repeat(review.rating)}</span>
                <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                <span className="ml-2 text-sm text-slate-600">{review.rating}/5</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Tarih</p>
              <p className="text-sm text-slate-700">{formatDateTime(review.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Doğrulanmış alıcı</p>
              <p className="text-sm text-slate-700">{review.isVerifiedBuyer ? 'Evet' : 'Hayır'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Faydalı oy</p>
              <p className="text-sm text-slate-700">{review.helpfulCount}</p>
            </div>
          </div>
          {review.title ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Başlık</p>
              <p className="text-base font-medium text-slate-900">{review.title}</p>
            </div>
          ) : null}
          {review.comment ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Yorum</p>
              <p className="whitespace-pre-line text-sm text-slate-700">{review.comment}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {review.status !== 'APPROVED' ? (
              <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Onayla
              </Button>
            ) : null}
            {review.status !== 'REJECTED' ? (
              <Button
                variant="secondary"
                onClick={() => rejectMut.mutate()}
                disabled={rejectMut.isPending}
              >
                <ThumbsDown className="mr-1 h-4 w-4" /> Reddet
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Bu yorumu silmek istediğinize emin misiniz?')) {
                  deleteMut.mutate();
                }
              }}
              disabled={deleteMut.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Sil
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
