/**
 * Refunds e2e — placeholder suite.
 *
 * SKIPPED until QA enables the e2e harness. These cases pin the refund
 * workflow: customer request → admin approve → order state transition
 * (+ partial_refunded handling).
 */
import { describe, it } from 'vitest';

describe.skip('refunds (e2e) — to be enabled by QA agent', () => {
  it('customer creates a refund request on a delivered order', async () => {
    // customer C owns order O in status 'delivered'
    // POST /v1/customers/me/orders/O/refund-request { reason, reasonCategory:'DAMAGED' }
    // expect 201 + refund_request.status === 'PENDING'
    // order transitions to 'refund_requested'; status history has note containing reason
  });

  it('admin approve converts to refunded + stub Refund row', async () => {
    // admin POST /v1/refund-requests/:id/approve { note: 'ok' }
    // expect refund_request.status === 'APPROVED', refunds row with status='stub_completed'
    // order.status === 'refunded', outbox has refund.approved event
  });

  it('admin approve partial amount → order moves to partial_refunded', async () => {
    // admin POST /v1/refund-requests/:id/approve { approvedAmount: '500', partial: true }
    // expect order.status === 'partial_refunded'; a further refund request is allowed
  });
});
