/**
 * Customers e2e — placeholder suite.
 *
 * Skipped until QA agent wires up the e2e harness (see products.e2e-spec.ts).
 */
import { describe, it } from 'vitest';

describe.skip('customers (e2e) — to be enabled by QA agent', () => {
  it('customer register + GET /v1/customers/me returns profile', async () => {
    // POST /v1/auth/customer/register with tenant subdomain header
    // use returned accessToken
    // GET /v1/customers/me → returns email + addresses []
  });

  it('address CRUD: create / update / delete / set default', async () => {
    // register, login
    // POST /v1/customers/me/addresses with isDefault=true
    // POST again with different body, isDefault=true → first address loses default
    // PATCH first back to isDefault=true → re-flips
    // POST /v1/customers/me/addresses/:id/default → idempotent
    // DELETE other address → 200
  });

  it('KVKK consent + export + delete_me', async () => {
    // POST /v1/customers/me/kvkk/consent with [{type:marketing_email, granted:true}]
    // GET /v1/customers/me/kvkk/export → JSON includes customer + consents + orders
    // DELETE /v1/customers/me → profile PII cleared, status='deleted_requested'
    // outbox has customer.deletion_requested event
  });
});
