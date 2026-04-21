/**
 * Unit tests for the pure `resolveEmailTriggers` helper. The actual fan-out
 * path is integration-covered.
 */
import { describe, expect, it } from 'vitest';
import { resolveEmailTriggers } from './outbox-dispatcher.processor';

describe('resolveEmailTriggers', () => {
  it('maps customer.registered → welcome', () => {
    expect(resolveEmailTriggers('customer.registered', {})).toEqual([
      { template: 'welcome' },
    ]);
  });

  it('maps order.created → order-confirmation', () => {
    expect(resolveEmailTriggers('order.created', {})).toEqual([
      { template: 'order-confirmation' },
    ]);
  });

  it('branches order.status_changed by new status', () => {
    expect(resolveEmailTriggers('order.status_changed', { to: 'shipped' })[0]).toEqual(
      { template: 'order-shipped' },
    );
    expect(
      resolveEmailTriggers('order.status_changed', { newStatus: 'delivered' })[0],
    ).toEqual({ template: 'order-delivered' });
    expect(
      resolveEmailTriggers('order.status_changed', { to: 'cancelled' })[0],
    ).toEqual({ template: 'order-cancelled' });
    expect(
      resolveEmailTriggers('order.status_changed', { to: 'preparing' }),
    ).toEqual([]);
  });

  it('maps refund.approved → refund-approved', () => {
    expect(resolveEmailTriggers('refund.approved', {})).toEqual([
      { template: 'refund-approved' },
    ]);
  });

  it('returns empty for unknown types', () => {
    expect(resolveEmailTriggers('nonsense.event', {})).toEqual([]);
  });
});
