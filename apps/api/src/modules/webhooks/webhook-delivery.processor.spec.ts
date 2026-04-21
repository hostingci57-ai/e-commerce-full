/**
 * Unit tests for the pure pieces of webhook delivery — specifically the HMAC
 * signing helper. The processor's HTTP path is integration-level and lives
 * in a separate e2e suite.
 */
import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { signWebhookPayload } from './webhook-delivery.processor';

describe('signWebhookPayload', () => {
  it('emits t=<unix>,v1=<sha256>', () => {
    const sig = signWebhookPayload('whsec_test', '{"a":1}', 1_700_000_000);
    expect(sig).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
  });

  it('matches a reference HMAC over `timestamp.body`', () => {
    const secret = 'whsec_test';
    const body = '{"hello":"world"}';
    const ts = 1_700_000_000;
    const expected = createHmac('sha256', secret)
      .update(`${ts}.${body}`)
      .digest('hex');
    expect(signWebhookPayload(secret, body, ts)).toBe(
      `t=${ts},v1=${expected}`,
    );
  });

  it('produces a different signature for a different body', () => {
    const a = signWebhookPayload('s', 'one', 1);
    const b = signWebhookPayload('s', 'two', 1);
    expect(a).not.toBe(b);
  });
});
