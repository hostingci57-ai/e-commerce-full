/**
 * Checkout e2e — placeholder suite.
 *
 * SKIPPED until QA enables the e2e harness. These assertions document the
 * three-step flow + completion semantics.
 */
import { describe, it } from 'vitest';

describe.skip('checkout (e2e) — to be enabled by QA agent', () => {
  it('POST /v1/checkout/start reserves inventory and returns a session token', async () => {
    // seed cart with qty 2 for variant V (stock = 5)
    // POST /v1/checkout/start
    // expect 201 + session { token, step: 'address', reservationIds.length === 1 }
    // DB: product_variants.stockReserved increased by 2
  });

  it('POST /v1/checkout/:token/address advances step to "shipping"', async () => {
    // create session then POST address
    // expect session.step === 'shipping'
  });

  it('POST /v1/checkout/:token/shipping stores the selected method + price', async () => {
    // create session, set address, then POST shipping { method: 'standard' }
    // expect shipping.priceMinor === 5000n
  });

  it('POST /v1/checkout/:token/payment stores the stub payment provider data', async () => {
    // seed session through to shipping
    // POST payment { method: 'stub_card' }
    // expect payment.status === 'pending_stub'
  });

  it('POST /v1/checkout/:token/complete creates Order + decrements stock + clears cart', async () => {
    // seed fully through address/shipping/payment
    // POST complete
    // expect { orderId, orderNumber, status: 'payment_success' }
    // cart in Redis is deleted; stockOnHand -= 2, stockReserved -= 2
    // outbox_events has order.created + order.paid
  });
});
