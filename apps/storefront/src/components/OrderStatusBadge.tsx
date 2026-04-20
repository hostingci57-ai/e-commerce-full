import { clsx } from 'clsx';
import type { OrderStatus } from '@/lib/types';

const MAP: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: 'Odeme Bekliyor', className: 'bg-amber-100 text-amber-800' },
  payment_success: { label: 'Odeme Alindi', className: 'bg-emerald-100 text-emerald-800' },
  preparing: { label: 'Hazirlaniyor', className: 'bg-sky-100 text-sky-800' },
  shipped: { label: 'Kargoda', className: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Teslim Edildi', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Iptal', className: 'bg-slate-100 text-slate-600' },
  refund_requested: { label: 'Iade Talebi', className: 'bg-orange-100 text-orange-800' },
  refunded: { label: 'Iade Edildi', className: 'bg-rose-100 text-rose-800' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const v = MAP[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        v.className,
      )}
    >
      {v.label}
    </span>
  );
}
