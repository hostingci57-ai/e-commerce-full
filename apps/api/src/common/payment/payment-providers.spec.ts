import { describe, it, expect } from 'vitest';
import { CodPaymentProvider } from './providers/cod.provider';
import { BankTransferPaymentProvider } from './providers/bank-transfer.provider';
import { StubCardPaymentProvider } from './providers/stub-card.provider';
import { ManualPaymentProvider } from './providers/manual.provider';
import type { PaymentInitInput } from './payment-provider.interface';

const baseInput: PaymentInitInput = {
  tenantId: '00000000-0000-0000-0000-000000000000',
  orderId: '00000000-0000-0000-0000-000000000001',
  amount: 10_000n,
  currency: 'TRY',
  customer: { id: null, email: 'guest@example.com', fullName: 'Guest User' },
};

describe('Payment providers', () => {
  describe('CodPaymentProvider', () => {
    const p = new CodPaymentProvider();

    it('reports its metadata', () => {
      expect(p.code).toBe('cod');
      expect(p.displayName).toContain('Kapıda');
      expect(p.isActive).toBe(true);
    });

    it('init resolves immediately to captured', async () => {
      const res = await p.init(baseInput);
      expect(res.status).toBe('captured');
      expect(res.providerRef).toMatch(/^cod_/);
    });

    it('capture is idempotent no-op', async () => {
      const res = await p.capture({
        tenantId: baseInput.tenantId,
        paymentId: 'p1',
        providerRef: 'cod_abc',
      });
      expect(res.status).toBe('captured');
      expect(res.paymentId).toBe('p1');
    });
  });

  describe('BankTransferPaymentProvider', () => {
    const p = new BankTransferPaymentProvider();

    it('init returns pending (requires admin capture)', async () => {
      const res = await p.init(baseInput);
      expect(res.status).toBe('pending');
      expect(res.providerRef).toMatch(/^bt_/);
    });

    it('capture flips to captured', async () => {
      const res = await p.capture({
        tenantId: baseInput.tenantId,
        paymentId: 'p2',
        providerRef: null,
      });
      expect(res.status).toBe('captured');
    });

    it('refund creates a pending refund', async () => {
      const res = await p.refund({
        tenantId: baseInput.tenantId,
        paymentId: 'p3',
        providerRef: null,
        amount: 1000n,
      });
      expect(res.status).toBe('pending');
      expect(res.refundId).toMatch(/^bt_refund_/);
    });
  });

  describe('StubCardPaymentProvider', () => {
    const p = new StubCardPaymentProvider();

    it('init captures immediately', async () => {
      const res = await p.init(baseInput);
      expect(res.status).toBe('captured');
      expect(res.providerRef).toMatch(/^stub_/);
    });

    it('refund returns refunded', async () => {
      const res = await p.refund({
        tenantId: baseInput.tenantId,
        paymentId: 'p4',
        providerRef: null,
        amount: 500n,
      });
      expect(res.status).toBe('refunded');
    });
  });

  describe('ManualPaymentProvider', () => {
    const p = new ManualPaymentProvider();

    it('init is pending', async () => {
      const res = await p.init(baseInput);
      expect(res.status).toBe('pending');
    });

    it('capture flips to captured', async () => {
      const res = await p.capture({
        tenantId: baseInput.tenantId,
        paymentId: 'p5',
        providerRef: null,
      });
      expect(res.status).toBe('captured');
    });
  });
});
