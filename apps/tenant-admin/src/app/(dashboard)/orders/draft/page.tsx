'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Plus, Receipt } from 'lucide-react';
import {
  convertDraftOrder,
  createDraftOrder,
  listDraftOrders,
  type DraftOrderListItem,
} from '@/lib/queries';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { formatDateTime, formatMoney, parseTryToKurus } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface DraftLineDraft {
  variantId: string;
  quantity: number;
  priceTry: string;
}

export default function DraftOrdersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    guestEmail: '',
    currency: 'TRY',
    shippingTry: '',
    note: '',
  });
  const [lines, setLines] = useState<DraftLineDraft[]>([
    { variantId: '', quantity: 1, priceTry: '' },
  ]);

  const draftsQ = useQuery({
    queryKey: ['draft-orders'],
    queryFn: () => listDraftOrders({ limit: 50 }),
    placeholderData: (prev) => prev,
  });

  const createMut = useMutation({
    mutationFn: createDraftOrder,
    onSuccess: () => {
      toast.success('Taslak oluşturuldu');
      qc.invalidateQueries({ queryKey: ['draft-orders'] });
      setOpen(false);
      setLines([{ variantId: '', quantity: 1, priceTry: '' }]);
      setForm({
        customerId: '',
        guestEmail: '',
        currency: 'TRY',
        shippingTry: '',
        note: '',
      });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı'),
  });

  const convertMut = useMutation({
    mutationFn: (id: string) => convertDraftOrder(id, { notifyCustomer: false }),
    onSuccess: () => {
      toast.success('Gerçek siparişe dönüştürüldü');
      qc.invalidateQueries({ queryKey: ['draft-orders'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Dönüştürülemedi'),
  });

  const rows = draftsQ.data?.items ?? [];

  const columns: Column<DraftOrderListItem>[] = [
    {
      key: 'orderNumber',
      header: 'Taslak',
      render: (r) => (
        <div>
          <div className="font-mono font-medium text-slate-900">
            {r.orderNumber ?? r.id.slice(0, 8)}
          </div>
          <div className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (r) => r.customerId ?? r.guestEmail ?? '—',
    },
    {
      key: 'status',
      header: 'Durum',
      render: () => <Badge tone="amber">Taslak</Badge>,
    },
    {
      key: 'total',
      header: 'Tutar',
      render: (r) => formatMoney(r.totalMinor ?? 0, r.currency ?? 'TRY'),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Link href={`/orders/${r.id}`}>
            <Button size="sm" variant="outline">
              Detay
            </Button>
          </Link>
          <Button
            size="sm"
            loading={convertMut.isPending && convertMut.variables === r.id}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Bu taslağı gerçek siparişe dönüştür?')) {
                convertMut.mutate(r.id);
              }
            }}
          >
            <ArrowRight className="h-4 w-4" /> Dönüştür
          </Button>
        </div>
      ),
    },
  ];

  const addLine = () =>
    setLines([...lines, { variantId: '', quantity: 1, priceTry: '' }]);

  const updateLine = (i: number, patch: Partial<DraftLineDraft>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const submit = () => {
    const validLines = lines.filter((l) => l.variantId);
    if (validLines.length === 0) {
      toast.error('En az bir satır ekleyin');
      return;
    }
    createMut.mutate({
      customerId: form.customerId || undefined,
      guestEmail: form.guestEmail || undefined,
      currency: form.currency,
      shippingMinor: form.shippingTry ? String(parseTryToKurus(form.shippingTry)) : undefined,
      note: form.note || undefined,
      lines: validLines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        priceMinorUnits: l.priceTry ? String(parseTryToKurus(l.priceTry)) : undefined,
      })),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Receipt className="h-6 w-6 text-brand-600" /> Taslak Siparişler
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Telefon/çağrı merkezi ile oluşturulan manuel siparişler burada tutulur.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Yeni taslak
        </Button>
      </div>

      <DataTable<DraftOrderListItem>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={draftsQ.isLoading}
        empty="Henüz taslak yok."
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Yeni taslak sipariş"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button loading={createMut.isPending} onClick={submit}>
              Oluştur
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Müşteri ID (opsiyonel)">
            <Input
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            />
          </FormField>
          <FormField label="Misafir e-posta (opsiyonel)">
            <Input
              value={form.guestEmail}
              onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
              placeholder="musteri@example.com"
            />
          </FormField>
          <FormField label="Para birimi" required>
            <Select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </FormField>
          <FormField label="Kargo tutarı (TL)">
            <Input
              value={form.shippingTry}
              onChange={(e) => setForm({ ...form, shippingTry: e.target.value })}
              placeholder="0.00"
            />
          </FormField>
          <FormField label="Not" className="md:col-span-2">
            <Textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </FormField>
        </div>

        <Card className="mt-4">
          <CardHeader
            title="Satırlar"
            action={
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4" /> Ekle
              </Button>
            }
          />
          <CardBody className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[2fr_80px_1fr_auto]">
                <Input
                  placeholder="variant UUID"
                  value={l.variantId}
                  onChange={(e) => updateLine(i, { variantId: e.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) =>
                    updateLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
                <Input
                  placeholder="Fiyat (TL, opsiyonel)"
                  value={l.priceTry}
                  onChange={(e) => updateLine(i, { priceTry: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                >
                  Sil
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      </Dialog>
    </div>
  );
}
