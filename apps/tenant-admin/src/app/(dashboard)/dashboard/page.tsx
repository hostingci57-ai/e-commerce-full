'use client';

import {
  AlertTriangle,
  Package,
  ShoppingBag,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '@/components/StatCard';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Stub data — backend KPI endpoint FSD 5.1 scope, yet to be wired.
const revenueSeries = Array.from({ length: 30 }).map((_, i) => {
  const day = new Date();
  day.setDate(day.getDate() - (29 - i));
  const base = 80_000 + Math.round(Math.sin(i / 3) * 20_000) + i * 1_500;
  return {
    date: day.toLocaleDateString('tr-TR', { month: '2-digit', day: '2-digit' }),
    revenue: base,
  };
});

const topProducts = [
  { name: 'Kadın Triko Kazak', sold: 148 },
  { name: 'Erkek Deri Ayakkabı', sold: 132 },
  { name: 'Çocuk Sweatshirt', sold: 97 },
  { name: 'Unisex Spor Çanta', sold: 82 },
  { name: 'Kadın Sneaker', sold: 71 },
];

const topCustomers = [
  { name: 'Ayşe Yılmaz', orders: 12, spend: 2_450_00 },
  { name: 'Mehmet Kaya', orders: 9, spend: 1_980_00 },
  { name: 'Zeynep Demir', orders: 7, spend: 1_760_00 },
  { name: 'Hasan Şahin', orders: 6, spend: 1_240_00 },
  { name: 'Elif Öztürk', orders: 5, spend: 980_00 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Gösterge Paneli</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mağazanızın günlük özetini buradan takip edin.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bugünün Cirosu"
          value={formatMoney(124_580_00)}
          delta={{ value: '+%12.4 (dün)', positive: true }}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Sipariş Sayısı"
          value="48"
          delta={{ value: '+6 (dün)', positive: true }}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <StatCard
          label="Yeni Müşteri"
          value="12"
          delta={{ value: '+2 (dün)', positive: true }}
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          label="Dönüşüm Oranı"
          value="%2.8"
          delta={{ value: '-%0.3 (dün)', positive: false }}
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader
          title="Son 30 Gün Ciro"
          description="Günlük ciro eğilimi"
        />
        <CardBody>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
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
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Lists + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="En Çok Satan Ürünler" description="Son 30 gün" />
          <CardBody className="px-0">
            <ol className="divide-y divide-slate-100">
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                      {i + 1}
                    </span>
                    <span className="truncate text-slate-700">{p.name}</span>
                  </span>
                  <span className="font-medium text-slate-600">{p.sold} adet</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top Müşteriler" description="Son 30 gün" />
          <CardBody className="px-0">
            <ol className="divide-y divide-slate-100">
              {topCustomers.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                      {i + 1}
                    </span>
                    <span className="truncate text-slate-700">{c.name}</span>
                  </span>
                  <span className="font-medium text-slate-600">
                    {c.orders} sipariş · {formatMoney(c.spend)}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Uyarılar"
            description="Aksiyon gerektiren durumlar"
            action={
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            }
          />
          <CardBody className="space-y-3">
            <AlertRow tone="amber" label="Düşük stok alarmları" value={7} />
            <AlertRow tone="rose" label="Bekleyen iade talepleri" value={3} />
            <AlertRow tone="slate" label="Terk edilmiş sepetler (48s)" value={21} />
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
}: {
  tone: 'amber' | 'rose' | 'slate';
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
