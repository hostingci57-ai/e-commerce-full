'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Plus, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookSubscriptions,
  updateWebhookSubscription,
  type WebhookSubscription,
} from '@/lib/queries';
import { Badge, Button, Checkbox, Dialog, Input, Label } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Canonical event catalogue surfaced to tenant-admins. New event families
 * added on the backend must be added here; wildcards (`order.*`) are also
 * allowed at the API layer.
 */
const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'customer.registered', label: 'Müşteri kaydı' },
  { value: 'order.created', label: 'Sipariş oluşturuldu' },
  { value: 'order.status_changed', label: 'Sipariş durumu değişti' },
  { value: 'refund.requested', label: 'İade talebi oluşturuldu' },
  { value: 'refund.approved', label: 'İade onaylandı' },
  { value: 'refund.rejected', label: 'İade reddedildi' },
];

interface FormState {
  id?: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  url: '',
  events: [],
  isActive: true,
};

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const subsQ = useQuery({
    queryKey: ['webhook-subscriptions'],
    queryFn: () => listWebhookSubscriptions(),
  });

  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof createWebhookSubscription>[0]) =>
      createWebhookSubscription(body),
    onSuccess: (data) => {
      toast.success('Abonelik oluşturuldu');
      setRevealedSecret(data.secret);
      qc.invalidateQueries({ queryKey: ['webhook-subscriptions'] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı'),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<WebhookSubscription>;
    }) => updateWebhookSubscription(id, body),
    onSuccess: () => {
      toast.success('Abonelik güncellendi');
      qc.invalidateQueries({ queryKey: ['webhook-subscriptions'] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWebhookSubscription(id),
    onSuccess: () => {
      toast.success('Abonelik silindi');
      qc.invalidateQueries({ queryKey: ['webhook-subscriptions'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Silinemedi'),
  });

  const rows = subsQ.data ?? [];

  const columns = useMemo<Column<WebhookSubscription>[]>(
    () => [
      {
        key: 'name',
        header: 'Ad',
        render: (r) => (
          <div className="flex flex-col gap-0.5">
            <Link
              href={`/webhooks/${r.id}`}
              className="font-medium text-slate-900 hover:text-brand-600"
            >
              {r.name}
            </Link>
            <span className="text-xs text-slate-500">{r.url}</span>
          </div>
        ),
      },
      {
        key: 'events',
        header: 'Olaylar',
        render: (r) => (
          <div className="flex flex-wrap gap-1">
            {r.events.map((ev) => (
              <Badge key={ev} tone="indigo">
                {ev}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Durum',
        render: (r) =>
          r.isActive ? (
            <Badge tone="green">Aktif</Badge>
          ) : (
            <Badge tone="slate">Pasif</Badge>
          ),
      },
      {
        key: 'failureCount',
        header: 'Hata',
        render: (r) =>
          r.failureCount > 0 ? (
            <Badge tone="rose">{r.failureCount}</Badge>
          ) : (
            <span className="text-slate-400">0</span>
          ),
      },
      {
        key: 'lastSuccessAt',
        header: 'Son başarı',
        render: (r) =>
          r.lastSuccessAt ? formatDateTime(r.lastSuccessAt) : '—',
      },
      {
        key: 'actions',
        header: '',
        render: (r) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setForm({
                  id: r.id,
                  name: r.name,
                  url: r.url,
                  events: r.events,
                  isActive: r.isActive,
                });
                setOpen(true);
              }}
            >
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`${r.name} aboneliğini sil?`)) {
                  deleteMut.mutate(r.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteMut],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <WebhookIcon className="h-6 w-6 text-brand-600" /> Webhooks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sisteminizde meydana gelen olayları 3. parti sistemlere HMAC-imzalı
            HTTP POST'ları ile iletin.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yeni abonelik
        </Button>
      </div>

      <DataTable<WebhookSubscription>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={subsQ.isLoading}
        empty="Henüz webhook aboneliği yok."
      />

      <WebhookForm
        open={open}
        form={form}
        setForm={setForm}
        busy={createMut.isPending || updateMut.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async () => {
          if (!form.name || !form.url || form.events.length === 0) {
            toast.error('Ad, URL ve en az bir olay seçin');
            return;
          }
          if (form.id) {
            await updateMut.mutateAsync({
              id: form.id,
              body: {
                name: form.name,
                url: form.url,
                events: form.events,
                isActive: form.isActive,
              },
            });
          } else {
            await createMut.mutateAsync({
              name: form.name,
              url: form.url,
              events: form.events,
              isActive: form.isActive,
            });
          }
        }}
      />

      {revealedSecret ? (
        <Dialog
          open={true}
          onClose={() => setRevealedSecret(null)}
          title="Webhook imzalama sırrı"
          description="Bu sır yalnızca bir kez gösterilir. Güvenli bir yerde saklayın."
          footer={
            <Button onClick={() => setRevealedSecret(null)}>Tamam</Button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                {revealedSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(revealedSecret);
                  toast.success('Panoya kopyalandı');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Gelen webhook&apos;ları doğrulamak için bu sır ile
              <code className="mx-1 rounded bg-slate-100 px-1">
                HMAC-SHA256({`{timestamp}.{body}`})
              </code>
              hesaplayıp{' '}
              <code className="mx-1 rounded bg-slate-100 px-1">
                X-Webhook-Signature
              </code>{' '}
              başlığı ile karşılaştırın.
            </p>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function WebhookForm({
  open,
  form,
  setForm,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: FormState;
  setForm: (f: FormState) => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const toggleEvent = (ev: string) => {
    setForm({
      ...form,
      events: form.events.includes(ev)
        ? form.events.filter((e) => e !== ev)
        : [...form.events, ev],
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={form.id ? 'Aboneliği düzenle' : 'Yeni webhook aboneliği'}
      description="HMAC-imzalı olay bildirimleri için hedef URL ve olay seçimi."
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={() => void onSubmit()} disabled={busy}>
            {form.id ? 'Güncelle' : 'Oluştur'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Ad</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="ör. Muhasebe entegrasyonu"
          />
        </div>
        <div>
          <Label>Hedef URL</Label>
          <Input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://example.com/webhooks/ecf"
          />
        </div>
        <div>
          <Label>Abone olunacak olaylar</Label>
          <div className="mt-1 grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            {EVENT_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.events.includes(opt.value)}
                  onChange={() => toggleEvent(opt.value)}
                />
                <span>
                  {opt.label}
                  <code className="ml-2 rounded bg-slate-100 px-1 text-xs text-slate-500">
                    {opt.value}
                  </code>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            label="Aktif"
          />
        </div>
      </div>
    </Dialog>
  );
}
