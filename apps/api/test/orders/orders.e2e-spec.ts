/**
 * Orders e2e — placeholder suite.
 *
 * SKIPPED until QA enables the e2e harness. These assertions document the
 * order lifecycle + state machine contract.
 */
import { describe, it } from 'vitest';

describe.skip('orders (e2e) — to be enabled by QA agent', () => {
  it('Checkout complete creates an order visible through GET /v1/orders/:id', async () => {
    // complete a checkout
    // GET /v1/orders/:id as admin → 200 with lines, status === 'payment_success'
  });

  it('GET /v1/orders supports filter by status + customerId and cursor pagination', async () => {
    // seed 25 orders for customer C
    // GET /v1/orders?status=payment_success&limit=10 → 10 items + nextCursor
    // GET /v1/orders?customerId=C → orders only for C
  });

  it('PATCH /v1/orders/:id/status enforces the state machine', async () => {
    // order in payment_success
    // PATCH { to: 'preparing' } → 200
    // PATCH { to: 'delivered' } → 400 invalid_transition (must go preparing→shipped first)
    // status history grows by one row per valid transition
  });

  it('POST /v1/orders/:id/cancel cancels while cancelable and emits outbox event', async () => {
    // order in pending_payment
    // POST /v1/orders/:id/cancel { reason: 'customer changed mind' }
    // expect status cancelled; outbox has order.cancelled + order.status_changed
  });

  it('POST /v1/customers/me/orders/:id/refund-request records a refund request', async () => {
    // customer C owns order in delivered
    // POST refund-request { reason: 'damaged on arrival' }
    // expect status refund_requested; status history row with note === reason
  });
});
