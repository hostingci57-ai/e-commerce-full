'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import {
  getWebhookSubscription,
  listWebhookDeliveries,
  retryWebhookDelivery,
  type WebhookDelivery,
} from '@/lib/queries';
import { Badge, Button, Select } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function WebhookDeliveriesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const qc = useQueryClient();
  const [status, setStatus] = useState<'all' | 'success' | 'failed' | 'pending'>(
    'all',
  );

  const subQ = useQuery({
    queryKey: ['webhook-subscription', id],
    queryFn: () => getWebhookSubscription(id),
    enabled: Boolean(id),
  });

  const deliveriesQ = useQuery({
    queryKey: ['webhook-deliveries', id, status],
    queryFn: () =>
      listWebhookDeliveries(id, {
        status: status === 'all' ? undefined : status,
        limit: 50,
      }),
    enabled: Boolean(id),
  });

  const retryMut = useMutation({
    mutationFn: (deliveryId: string) => retryWebhookDelivery(id, deliveryId),
    onSuccess: () => {
      toast.success('Yeniden teslim alındı');
      qc.invalidateQueries({ queryKey: ['webhook-deliveries', id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Başarısız'),
  });

  const rows = deliveriesQ.data?.items ?? [];

  const columns = useMemo<Column<WebhookDelivery>[]>(
    () => [
      {
        key: 'createdAt',
        header: 'Zaman',
        render: (r) => formatDateTime(r.createdAt),
      },
      {
        key: 'eventType',
        header: 'Olay',
        render: (r) => (
          <span className="font-mono text-xs text-slate-700">
            {r.eventType}
          </span>
        ),
      },
      {
        key: 'attempt',
        header: 'Deneme',
        render: (r) => r.attempt,
      },
      {
        key: 'statusCode',
        header: 'HTTP',
        render: (r) => {
          if (r.deliveredAt) {
            return <Badge tone="green">{r.statusCode ?? '2xx'}</Badge>;
          }
          if (r.statusCode) {
            return <Badge tone="rose">{r.statusCode}</Badge>;
          }
          return <Badge tone="amber">—</Badge>;
        },
      },
      {
        key: 'errorMessage',
        header: 'Hata',
        render: (r) =>
          r.errorMessage ? (
            <span className="text-xs text-rose-600">{r.errorMessage}</span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
      {
        key: 'actions',
        header: '',
        render: (r) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                retryMut.mutate(r.id);
              }}
              disabled={retryMut.isPending}
            >
              <RotateCcw className="h-4 w-4" /> Yeniden dene
            </Button>
          </div>
        ),
      },
    ],
    [retryMut],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href="/webhooks"
          className="inline-flex items-center gap-1 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Webhooks
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {subQ.data?.name ?? 'Abonelik'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{subQ.data?.url}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(subQ.data?.events ?? []).map((ev) => (
            <Badge key={ev} tone="indigo">
              {ev}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">Tüm teslimatlar</option>
          <option value="success">Başarılı</option>
          <option value="failed">Başarısız</option>
          <option value="pending">Bekliyor</option>
        </Select>
      </div>

      <DataTable<WebhookDelivery>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={deliveriesQ.isLoading}
        empty="Henüz teslimat kaydı yok."
      />
    </div>
  );
}
