import { BadRequestException } from '@nestjs/common';
import type { OrderStatus } from '@ecf/db';

/**
 * Order finite state machine per FSD 5.3.3 / 5.3.4.
 *
 *   draft           → pending_payment | cancelled          (admin drafts, Faz 6b)
 *   pending_payment → payment_success | cancelled
 *   payment_success → preparing | cancelled | refund_requested
 *   preparing       → shipped | cancelled | refund_requested
 *   shipped         → delivered | refund_requested
 *   delivered       → closed | refund_requested
 *   refund_requested→ refunded | partial_refunded | cancelled   (Faz 6b)
 *   partial_refunded→ refund_requested | closed                  (further returns allowed)
 *
 *   closed / cancelled / refunded  → TERMINAL
 *
 * Any edge not explicitly listed here is invalid and the transition will
 * throw a BadRequestException.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['payment_success', 'payment_failed', 'cancelled'],
  payment_failed: ['pending_payment', 'cancelled'],
  payment_success: ['preparing', 'cancelled', 'refund_requested'],
  preparing: ['shipped', 'cancelled', 'refund_requested'],
  shipped: ['delivered', 'refund_requested'],
  delivered: ['closed', 'refund_requested'],
  closed: [],
  cancelled: [],
  refund_requested: ['refunded', 'partial_refunded', 'cancelled'],
  partial_refunded: ['refund_requested', 'closed'],
  refunded: [],
};

const TERMINAL = new Set<OrderStatus>(['closed', 'cancelled', 'refunded']);

export class OrderStateMachine {
  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  static allowedFrom(from: OrderStatus): readonly OrderStatus[] {
    return TRANSITIONS[from];
  }

  static isTerminal(status: OrderStatus): boolean {
    return TERMINAL.has(status);
  }

  /**
   * Assert the transition is valid; throw BadRequestException otherwise.
   * Kept as a static helper so services don't have to re-format the error.
   */
  static assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (from === to) {
      throw new BadRequestException({
        code: 'order_status_noop',
        message: `Order is already in status ${from}`,
      });
    }
    if (!OrderStateMachine.canTransition(from, to)) {
      throw new BadRequestException({
        code: 'order_status_invalid_transition',
        message: `Invalid transition ${from} → ${to}`,
        details: { allowed: TRANSITIONS[from] },
      });
    }
  }
}
