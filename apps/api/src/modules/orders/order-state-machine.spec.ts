import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OrderStateMachine } from './order-state-machine';
import type { OrderStatus } from '@ecf/db';

/**
 * Unit tests for the order finite-state machine per FSD 5.3.3.
 *
 * The state graph is:
 *   pending_payment  → payment_success | cancelled
 *   payment_success  → preparing | cancelled | refund_requested
 *   preparing        → shipped | cancelled | refund_requested
 *   shipped          → delivered | refund_requested
 *   delivered        → closed | refund_requested
 *   refund_requested → refunded | cancelled
 *   closed | cancelled | refunded → TERMINAL (no transitions out)
 */
describe('OrderStateMachine', () => {
  describe('allowedFrom — exact transition map', () => {
    it('pending_payment → [payment_success, cancelled]', () => {
      expect([...OrderStateMachine.allowedFrom('pending_payment')].sort()).toEqual(
        ['cancelled', 'payment_success'].sort(),
      );
    });

    it('payment_success → [preparing, cancelled, refund_requested]', () => {
      expect([...OrderStateMachine.allowedFrom('payment_success')].sort()).toEqual(
        ['cancelled', 'preparing', 'refund_requested'].sort(),
      );
    });

    it('preparing → [shipped, cancelled, refund_requested]', () => {
      expect([...OrderStateMachine.allowedFrom('preparing')].sort()).toEqual(
        ['cancelled', 'refund_requested', 'shipped'].sort(),
      );
    });

    it('shipped → [delivered, refund_requested]', () => {
      expect([...OrderStateMachine.allowedFrom('shipped')].sort()).toEqual(
        ['delivered', 'refund_requested'].sort(),
      );
    });

    it('delivered → [closed, refund_requested]', () => {
      expect([...OrderStateMachine.allowedFrom('delivered')].sort()).toEqual(
        ['closed', 'refund_requested'].sort(),
      );
    });

    it('refund_requested → [refunded, cancelled]', () => {
      expect([...OrderStateMachine.allowedFrom('refund_requested')].sort()).toEqual(
        ['cancelled', 'refunded'].sort(),
      );
    });
  });

  describe('terminal states', () => {
    const terminal: OrderStatus[] = ['closed', 'cancelled', 'refunded'];

    it.each(terminal)('%s is terminal', (status) => {
      expect(OrderStateMachine.isTerminal(status)).toBe(true);
      expect(OrderStateMachine.allowedFrom(status)).toHaveLength(0);
    });

    it.each(terminal)('%s rejects ANY outbound transition', (from) => {
      const targets: OrderStatus[] = [
        'pending_payment',
        'payment_success',
        'preparing',
        'shipped',
        'delivered',
        'refund_requested',
      ];
      for (const to of targets) {
        expect(OrderStateMachine.canTransition(from, to)).toBe(false);
      }
    });
  });

  describe('non-terminal sources are not marked terminal', () => {
    const live: OrderStatus[] = [
      'pending_payment',
      'payment_success',
      'preparing',
      'shipped',
      'delivered',
      'refund_requested',
    ];

    it.each(live)('%s is not terminal', (status) => {
      expect(OrderStateMachine.isTerminal(status)).toBe(false);
    });
  });

  describe('canTransition — returns boolean for every pair', () => {
    it('happy path pending_payment → payment_success is true', () => {
      expect(OrderStateMachine.canTransition('pending_payment', 'payment_success')).toBe(true);
    });

    it('shipped → delivered is true', () => {
      expect(OrderStateMachine.canTransition('shipped', 'delivered')).toBe(true);
    });

    it('shipped → cancelled is NOT allowed (cannot cancel once shipped)', () => {
      expect(OrderStateMachine.canTransition('shipped', 'cancelled')).toBe(false);
    });

    it('payment_success → delivered skip is NOT allowed', () => {
      expect(OrderStateMachine.canTransition('payment_success', 'delivered')).toBe(false);
    });

    it('pending_payment → preparing skip is NOT allowed', () => {
      expect(OrderStateMachine.canTransition('pending_payment', 'preparing')).toBe(false);
    });
  });

  describe('assertTransition — raises BadRequestException on invalid', () => {
    it('throws BadRequestException with invalid_transition code on illegal edge', () => {
      try {
        OrderStateMachine.assertTransition('shipped', 'cancelled');
        throw new Error('expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const body = (err as BadRequestException).getResponse() as {
          code: string;
          message: string;
          details: { allowed: readonly OrderStatus[] };
        };
        expect(body.code).toBe('order_status_invalid_transition');
        expect(body.details.allowed).toEqual(OrderStateMachine.allowedFrom('shipped'));
      }
    });

    it('throws noop code when from === to (no silent identity)', () => {
      try {
        OrderStateMachine.assertTransition('preparing', 'preparing');
        throw new Error('expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const body = (err as BadRequestException).getResponse() as { code: string };
        expect(body.code).toBe('order_status_noop');
      }
    });

    it('does NOT throw on valid transition', () => {
      expect(() =>
        OrderStateMachine.assertTransition('payment_success', 'preparing'),
      ).not.toThrow();
    });
  });

  describe('full canonical happy-path is reachable through valid edges', () => {
    it('pending_payment → payment_success → preparing → shipped → delivered → closed', () => {
      const path: OrderStatus[] = [
        'pending_payment',
        'payment_success',
        'preparing',
        'shipped',
        'delivered',
        'closed',
      ];
      for (let i = 0; i < path.length - 1; i++) {
        expect(OrderStateMachine.canTransition(path[i]!, path[i + 1]!)).toBe(true);
      }
      expect(OrderStateMachine.isTerminal(path[path.length - 1]!)).toBe(true);
    });

    it('refund path shipped → refund_requested → refunded', () => {
      expect(OrderStateMachine.canTransition('shipped', 'refund_requested')).toBe(true);
      expect(OrderStateMachine.canTransition('refund_requested', 'refunded')).toBe(true);
      expect(OrderStateMachine.isTerminal('refunded')).toBe(true);
    });
  });
});
