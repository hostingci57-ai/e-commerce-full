/**
 * Unit tests for EmailService and the template registry. We don't spin Redis;
 * the Queue is stubbed. Coverage:
 *   - welcome template renders customer first name + tenant name
 *   - order-confirmation renders all line items
 *   - sendEmail enqueues a job with the expected shape and rejects unknown templates
 */
import { describe, expect, it, vi } from 'vitest';
import { EmailService } from './email.service';
import { renderTemplate } from './templates/registry';

function makeService() {
  const queue = { add: vi.fn().mockResolvedValue({ id: 'q-1' }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new EmailService(queue as any);
  return { svc, queue };
}

describe('EmailService.renderTemplate', () => {
  it('renders welcome template with firstName + tenantName', () => {
    const out = renderTemplate('welcome', {
      firstName: 'Ayşe',
      tenantName: 'Acme',
    });
    expect(out.subject).toBe('Acme — Hoş Geldiniz');
    expect(out.text).toContain('Merhaba Ayşe');
    expect(out.text).toContain('Acme');
  });

  it('renders order-confirmation with line items', () => {
    const out = renderTemplate('order-confirmation', {
      firstName: 'Ali',
      tenantName: 'Acme',
      orderNumber: 'A-0001',
      totalFormatted: '123,45 ₺',
      lines: [
        { title: 'T-Shirt', quantity: 2, totalFormatted: '100,00 ₺' },
        { title: 'Mug', quantity: 1, totalFormatted: '23,45 ₺' },
      ],
    });
    expect(out.subject).toContain('A-0001');
    expect(out.text).toContain('- T-Shirt x 2 = 100,00 ₺');
    expect(out.text).toContain('- Mug x 1 = 23,45 ₺');
  });
});

describe('EmailService.sendEmail', () => {
  it('enqueues a direct job with template + data payload', async () => {
    const { svc, queue } = makeService();
    await svc.sendEmail({
      to: 'a@example.com',
      template: 'welcome',
      data: { firstName: 'Ayşe', tenantName: 'Acme' },
      tenantId: 't-1',
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queue.add.mock.calls[0];
    expect(name).toBe('send');
    expect(data).toMatchObject({
      to: 'a@example.com',
      template: 'welcome',
      tenantId: 't-1',
      source: 'direct',
    });
    expect((opts as { attempts: number }).attempts).toBe(3);
  });

  it('throws on unknown templates before enqueuing', async () => {
    const { svc, queue } = makeService();
    await expect(
      svc.sendEmail({
        to: 'x@example.com',
        template: 'no-such-template',
        data: {},
      }),
    ).rejects.toThrow(/Unknown email template/);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
