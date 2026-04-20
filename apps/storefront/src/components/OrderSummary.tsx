import { formatPrice } from '@/lib/format';
import type { CartTotals } from '@/lib/types';

export function OrderSummary({ totals }: { totals: CartTotals }) {
  const c = totals.currency;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-3 font-semibold text-slate-900">Siparis Ozeti</h3>
      <dl className="space-y-2">
        <Row label="Ara Toplam" value={formatPrice(totals.subtotal, c)} />
        {totals.discount > 0 ? (
          <Row
            label="Indirim"
            value={`- ${formatPrice(totals.discount, c)}`}
            className="text-green-700"
          />
        ) : null}
        <Row label="Kargo" value={formatPrice(totals.shipping, c)} />
        {totals.tax > 0 ? (
          <Row label="KDV" value={formatPrice(totals.tax, c)} />
        ) : null}
      </dl>
      <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base">
        <span className="font-semibold">Toplam</span>
        <span className="font-bold text-slate-900">
          {formatPrice(totals.total, c)}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between ${className ?? ''}`}>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
