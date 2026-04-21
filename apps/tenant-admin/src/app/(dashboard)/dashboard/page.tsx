'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CreditCard,
  Package,
  ShoppingBag,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '@/components/StatCard';
import { Badge, Card, CardBody, CardHeader, Input, Label } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import {
  fetchAlerts,
  fetchKpis,
  fetchOrdersByStatus,
  fetchRevenueSeries,
  fetchSalesByCategory,
  fetchTopCustomers,
  fetchTopProducts,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * Default window = last 30 calendar days. We format as `YYYY-MM-DD` so the
 * <input type="date"> widget accepts them and the backend parses them as UTC
 * midnight (the canonical interpretation in AnalyticsService.resolveRange).
 */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

const CATEGORY_PALETTE = [
  '#2563eb',
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#f472b6',
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  pending_payment: 'Ödeme Bekliyor',
  payment_success: 'Ödeme Alındı',
  payment_failed: 'Ödeme Başarısız',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoda',
  delivered: 'Teslim Edildi',
  closed: 'Kapandı',
  cancelled: 'İptal',
  refund_requested: 'İade Talebi',
  refunded: 'İade Edildi',
  partial_refunded: 'Kısmi İade',
};

export default function DashboardPage() {
  const [range, setRange] = useState(defaultRange);

  // Turn { from, to } into ISO-8601 boundaries so the API treats them as UTC.
  const params = useMemo(
    () => ({
      from: `${range.from}T00:00:00.000Z`,
      to: `${range.to}T23:59:59.999Z`,
    }),
    [range],
  );

  const kpis = useQuery({
    queryKey: ['analytics', 'kpis', params],
    queryFn: () => fetchKpis(params),
  });
  const series = useQuery({
    queryKey: ['analytics', 'revenue-series', params],
    queryFn: () => fetchRevenueSeries({ ...params, granularity: 'day' }),
  });
  const topProducts = useQuery({
    queryKey: ['analytics', 'top-products', params],
    queryFn: () => fetchTopProducts({ ...params, limit: 5 }),
  });
  const topCustomers = useQuery({
    queryKey: ['analytics', 'top-customers', params],
    queryFn: () => fetchTopCustomers({ ...params, limit: 5 }),
  });
  const byCategory = useQuery({
    queryKey: ['analytics', 'sales-by-category', params],
    queryFn: () => fetchSalesByCategory(params),
  });
  const byStatus = useQuery({
    queryKey: ['analytics', 'orders-by-status', params],
    queryFn: () => fetchOrdersByStatus(params),
  });
  const alerts = useQuery({
    queryKey: ['analytics', 'alerts'],
    queryFn: fetchAlerts,
  });

  // Recharts data adapters.
  const seriesChartData = useMemo(
    () =>
      (series.data ?? []).map((p) => ({
        date: new Date(p.period).toLocaleDateString('tr-TR', {
          month: '2-digit',
          day: '2-digit',
        }),
        revenue: Number(p.revenueMinor),
        orderCount: p.orderCount,
      })),
    [series.data],
  );

  const statusChartData = useMemo(
    () =>
      (byStatus.data ?? []).map((r) => ({
        status: STATUS_LABEL[r.status] ?? r.status,
        count: r.count,
      })),
    [byStatus.data],
  );

  const categoryChartData = useMemo(
    () =>
      (byCategory.data ?? []).map((r) => ({
        name: r.name,
        value: Number(r.totalRevenueMinor),
      })),
    [byCategory.data],
  );

  return (
    <div className="space-y-6">
      {/* Heading + date range picker */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gösterge Paneli</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mağazanızın performansını tarih aralığına göre analiz edin.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="range-from">Başlangıç</Label>
            <Input
              id="range-from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="max-w-[10rem]"
            />
          </div>
          <div>
            <Label htmlFor="range-to">Bitiş</Label>
            <Input
              id="range-to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="max-w-[10rem]"
            />
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ciro"
          value={kpis.isLoading ? <Skeleton /> : formatMoney(kpis.data?.revenueMinor ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Sipariş"
          value={kpis.isLoading ? <Skeleton /> : (kpis.data?.orderCount ?? 0).toLocaleString('tr-TR')}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <StatCard
          label="Yeni Müşteri"
          value={
            kpis.isLoading ? <Skeleton /> : (kpis.data?.newCustomerCount ?? 0).toLocaleString('tr-TR')
          }
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          label="Ort. Sipariş Tutarı"
          value={
            kpis.isLoading ? <Skeleton /> : formatMoney(kpis.data?.averageOrderValueMinor ?? 0)
          }
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      {/* Alerts banner */}
      <Card>
        <CardHeader
          title="Uyarılar"
          description="Aksiyon gerektiren durumlar"
          action={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />}
        />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AlertRow
            tone="amber"
            label="Düşük stok"
            value={alerts.data?.lowStockCount ?? 0}
            loading={alerts.isLoading}
          />
          <AlertRow
            tone="rose"
            label="Bekleyen iade"
            value={alerts.data?.pendingRefundCount ?? 0}
            loading={alerts.isLoading}
          />
          <AlertRow
            tone="cyan"
            label="Terk edilmiş sepet"
            value={alerts.data?.abandonedCartCount ?? 0}
            loading={alerts.isLoading}
          />
          <AlertRow
            tone="slate"
            label="Onay bekleyen havale"
            value={alerts.data?.bankTransferPendingCount ?? 0}
            loading={alerts.isLoading}
            icon={<CreditCard className="h-3.5 w-3.5" />}
          />
        </CardBody>
      </Card>

      {/* Revenue line chart */}
      <Card>
        <CardHeader title="Günlük Ciro" description="Seçilen tarih aralığı" />
        <CardBody>
          {series.isLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesChartData} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) => `${Math.round(v / 100 / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatMoney(value)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Status bar + category pie */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sipariş Durumları" description="Seçilen tarih aralığı" />
          <CardBody>
            {byStatus.isLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Kategoriye Göre Satış" description="Ciro oranları" />
          <CardBody>
            {byCategory.isLoading ? (
              <ChartSkeleton />
            ) : categoryChartData.length === 0 ? (
              <EmptyState message="Bu aralıkta kategori bazlı veri yok" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {categoryChartData.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatMoney(value)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="En Çok Satan Ürünler" description="Ciro sıralamalı" />
          <CardBody className="px-0">
            {topProducts.isLoading ? (
              <ListSkeleton />
            ) : (topProducts.data ?? []).length === 0 ? (
              <EmptyState message="Bu aralıkta satış bulunmuyor" />
            ) : (
              <ol className="divide-y divide-slate-100">
                {topProducts.data!.map((p, i) => (
                  <li
                    key={p.productId || `tp-${i}`}
                    className="flex items-center justify-between px-5 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                        {i + 1}
                      </span>
                      <span className="truncate text-slate-700">{p.title || 'Ürün silinmiş'}</span>
                    </span>
                    <span className="shrink-0 text-right font-medium text-slate-600">
                      {p.totalQuantity} adet · {formatMoney(p.totalRevenueMinor)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top Müşteriler" description="Harcama sıralamalı" />
          <CardBody className="px-0">
            {topCustomers.isLoading ? (
              <ListSkeleton />
            ) : (topCustomers.data ?? []).length === 0 ? (
              <EmptyState message="Bu aralıkta müşteri satışı yok" />
            ) : (
              <ol className="divide-y divide-slate-100">
                {topCustomers.data!.map((c, i) => (
                  <li
                    key={c.customerId || `tc-${i}`}
                    className="flex items-center justify-between px-5 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                        {i + 1}
                      </span>
                      <span className="truncate text-slate-700">
                        {c.name?.trim() || c.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-medium text-slate-600">
                      {c.orderCount} sipariş · {formatMoney(c.totalSpentMinor)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AlertRow({
  tone,
  label,
  value,
  loading,
  icon,
}: {
  tone: 'amber' | 'rose' | 'slate' | 'cyan';
  label: string;
  value: number;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-sm text-slate-700">
        {icon}
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-5 w-10" />
      ) : (
        <Badge tone={tone}>{value}</Badge>
      )}
    </div>
  );
}

function Skeleton({ className = 'h-6 w-24' }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded bg-slate-200 ${className}`} />;
}
function ChartSkeleton() {
  return <div className="h-72 w-full animate-pulse rounded bg-slate-100" />;
}
function ListSkeleton() {
  return (
    <div className="space-y-2 p-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{message}</p>;
}
