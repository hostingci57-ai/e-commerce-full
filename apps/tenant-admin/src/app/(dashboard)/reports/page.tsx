'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, LineChart, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardBody, CardHeader, Input, Label } from '@/components/ui';
import { downloadBlob } from '@/lib/api';

export const dynamic = 'force-dynamic';

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [orderRange, setOrderRange] = useState(defaultRange);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [salesRange, setSalesRange] = useState(defaultRange);
  const [downloading, setDownloading] = useState<string | null>(null);

  /**
   * Converts the shorthand `YYYY-MM-DD` range to full-day ISO bounds before
   * handing them off to the CSV endpoint — matches dashboard convention.
   */
  function boundsFor(range: { from: string; to: string }): { from: string; to: string } {
    return {
      from: `${range.from}T00:00:00.000Z`,
      to: `${range.to}T23:59:59.999Z`,
    };
  }

  async function handleDownload(
    key: string,
    path: string,
    query: Record<string, string | undefined>,
    filename: string,
  ) {
    try {
      setDownloading(key);
      await downloadBlob(path, query, filename);
      toast.success('Rapor indirildi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İndirme başarısız');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Raporlar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sipariş, satış ve müşteri verilerini CSV formatında dışa aktarın.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Orders CSV */}
        <Card>
          <CardHeader
            title="Siparişler"
            description="Sipariş listesi (satır başına 1 sipariş)"
            action={<FileSpreadsheet className="h-5 w-5 text-brand-500" aria-hidden />}
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="orders-from">Başlangıç</Label>
                <Input
                  id="orders-from"
                  type="date"
                  value={orderRange.from}
                  max={orderRange.to}
                  onChange={(e) => setOrderRange((r) => ({ ...r, from: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="orders-to">Bitiş</Label>
                <Input
                  id="orders-to"
                  type="date"
                  value={orderRange.to}
                  min={orderRange.from}
                  onChange={(e) => setOrderRange((r) => ({ ...r, to: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="orders-status">Durum (ops.)</Label>
              <select
                id="orders-status"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
              >
                <option value="">Tümü</option>
                <option value="pending_payment">Ödeme Bekliyor</option>
                <option value="payment_success">Ödeme Alındı</option>
                <option value="preparing">Hazırlanıyor</option>
                <option value="shipped">Kargoda</option>
                <option value="delivered">Teslim Edildi</option>
                <option value="cancelled">İptal</option>
                <option value="refunded">İade Edildi</option>
              </select>
            </div>
            <Button
              type="button"
              loading={downloading === 'orders'}
              onClick={() =>
                handleDownload(
                  'orders',
                  '/reports/orders.csv',
                  { ...boundsFor(orderRange), status: orderStatus || undefined },
                  `orders-${today()}.csv`,
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> CSV İndir
            </Button>
          </CardBody>
        </Card>

        {/* Sales CSV */}
        <Card>
          <CardHeader
            title="Günlük Satış"
            description="Gün bazlı ciro + sipariş sayısı"
            action={<LineChart className="h-5 w-5 text-brand-500" aria-hidden />}
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="sales-from">Başlangıç</Label>
                <Input
                  id="sales-from"
                  type="date"
                  value={salesRange.from}
                  max={salesRange.to}
                  onChange={(e) => setSalesRange((r) => ({ ...r, from: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="sales-to">Bitiş</Label>
                <Input
                  id="sales-to"
                  type="date"
                  value={salesRange.to}
                  min={salesRange.from}
                  onChange={(e) => setSalesRange((r) => ({ ...r, to: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Sadece <code className="rounded bg-slate-100 px-1">payment_success</code> ve sonrası
              siparişler dahildir.
            </p>
            <Button
              type="button"
              loading={downloading === 'sales'}
              onClick={() =>
                handleDownload(
                  'sales',
                  '/reports/sales.csv',
                  boundsFor(salesRange),
                  `sales-${today()}.csv`,
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> CSV İndir
            </Button>
          </CardBody>
        </Card>

        {/* Customers CSV */}
        <Card>
          <CardHeader
            title="Müşteriler"
            description="LTV + sipariş sayısı (tüm zamanlar)"
            action={<Users className="h-5 w-5 text-brand-500" aria-hidden />}
          />
          <CardBody className="space-y-3">
            <p className="text-sm text-slate-600">
              Tüm müşterilerin toplam harcama ve sipariş sayısı ile birlikte dışa aktarılır. Bu rapor
              tarih aralığı almaz.
            </p>
            <Button
              type="button"
              loading={downloading === 'customers'}
              onClick={() =>
                handleDownload(
                  'customers',
                  '/reports/customers.csv',
                  {},
                  `customers-${today()}.csv`,
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> CSV İndir
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
