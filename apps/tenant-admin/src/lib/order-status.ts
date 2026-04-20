/**
 * Mirrors apps/api/src/modules/orders/order-state-machine.ts.
 * Duplicated here (instead of importing) so the admin UI can work when
 * the API types aren't imported yet. Source of truth: backend.
 */

export type OrderStatus =
  | 'pending_payment'
  | 'payment_success'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'closed'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['payment_success', 'cancelled'],
  payment_success: ['preparing', 'cancelled', 'refund_requested'],
  preparing: ['shipped', 'cancelled', 'refund_requested'],
  shipped: ['delivered', 'refund_requested'],
  delivered: ['closed', 'refund_requested'],
  closed: [],
  cancelled: [],
  refund_requested: ['refunded', 'cancelled'],
  refunded: [],
};

const TERMINAL = new Set<OrderStatus>(['closed', 'cancelled', 'refunded']);

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.has(status);
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Ödeme Bekliyor',
  payment_success: 'Ödendi',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  closed: 'Kapatıldı',
  cancelled: 'İptal Edildi',
  refund_requested: 'İade Talebi',
  refunded: 'İade Edildi',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800 ring-amber-200',
  payment_success: 'bg-blue-100 text-blue-800 ring-blue-200',
  preparing: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  shipped: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-800 ring-slate-200',
  cancelled: 'bg-rose-100 text-rose-800 ring-rose-200',
  refund_requested: 'bg-orange-100 text-orange-800 ring-orange-200',
  refunded: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
};
