import Handlebars from 'handlebars';

/**
 * Inline templates. Kept in-TS so the NestJS build bundles them without a
 * separate asset-copy step. Each template exports a `subject` plus `text`
 * body and is compiled lazily at first use.
 */
interface TemplateSource {
  subject: string;
  text: string;
  html?: string;
}

const SOURCES: Record<string, TemplateSource> = {
  'welcome': {
    subject: '{{tenantName}} — Hoş Geldiniz',
    text: `Merhaba {{firstName}},

{{tenantName}} e-ticaret mağazasına kaydolduğunuz için teşekkür ederiz.
Siparişlerinizi ve hesap bilgilerinizi hesabım sayfasından takip edebilirsiniz.

İyi alışverişler!
{{tenantName}}`,
  },
  'order-confirmation': {
    subject: 'Siparişiniz alındı — #{{orderNumber}}',
    text: `Merhaba {{firstName}},

#{{orderNumber}} numaralı siparişiniz alındı. Toplam tutar: {{totalFormatted}}.

Sipariş detayları:
{{#each lines}}
- {{title}} x {{quantity}} = {{totalFormatted}}
{{/each}}

Kısa süre içinde kargoya verileceğinde size bildireceğiz.

{{tenantName}}`,
  },
  'order-shipped': {
    subject: 'Siparişiniz kargoya verildi — #{{orderNumber}}',
    text: `Merhaba {{firstName}},

#{{orderNumber}} numaralı siparişiniz kargoya verildi{{#if trackingNumber}} (takip numarası: {{trackingNumber}}){{/if}}.

{{tenantName}}`,
  },
  'order-delivered': {
    subject: 'Siparişiniz teslim edildi — #{{orderNumber}}',
    text: `Merhaba {{firstName}},

#{{orderNumber}} numaralı siparişiniz adresinize teslim edildi. Umarız memnun kalırsınız!

{{tenantName}}`,
  },
  'order-cancelled': {
    subject: 'Siparişiniz iptal edildi — #{{orderNumber}}',
    text: `Merhaba {{firstName}},

#{{orderNumber}} numaralı siparişiniz iptal edildi. Ödemeniz yapıldıysa en kısa sürede iade edilecektir.

{{tenantName}}`,
  },
  'refund-approved': {
    subject: 'İade talebiniz onaylandı — #{{orderNumber}}',
    text: `Merhaba {{firstName}},

#{{orderNumber}} numaralı siparişiniz için iade talebiniz onaylandı.
Onaylanan tutar: {{amountFormatted}}.

{{tenantName}}`,
  },
  'password-reset': {
    subject: 'Şifre sıfırlama bağlantısı',
    text: `Merhaba{{#if firstName}} {{firstName}}{{/if}},

Aşağıdaki bağlantıya tıklayarak şifrenizi sıfırlayabilirsiniz. Bağlantı {{ttlMinutes}} dakika geçerlidir.

{{resetUrl}}

Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.

{{tenantName}}`,
  },
  'tenant-welcome': {
    subject: 'ECF mağazanıza hoş geldiniz — {{tenantName}}',
    text: `Merhaba {{ownerName}},

{{tenantName}} mağazanız başarıyla oluşturuldu. Şu adresten yönetebilirsiniz:
{{adminUrl}}

Mağaza URL'niz: https://{{subdomain}}.{{baseDomain}}

ECF Ekibi`,
  },
  'abandoned-cart-recovery': {
    subject: 'Sepetinizde unuttuğunuz ürünler var',
    text: `Merhaba,

Sepetinizde tamamlamadığınız ürünler bulunuyor. Alışverişinizi kaldığınız yerden sürdürmek için aşağıdaki bağlantıya tıklayabilirsiniz:

{{resumeUrl}}

Sepet içeriği:
{{#each items}}- {{title}} x {{qty}} = {{price}}
{{/each}}
Toplam: {{total}}

Stoklar tükenebilir, acele edin!`,
  },
};

const COMPILED = new Map<string, { subject: HandlebarsTemplateDelegate; text: HandlebarsTemplateDelegate; html?: HandlebarsTemplateDelegate }>();

function ensureCompiled(name: string) {
  const existing = COMPILED.get(name);
  if (existing) return existing;
  const src = SOURCES[name];
  if (!src) {
    throw new Error(`Unknown email template: ${name}`);
  }
  const compiled = {
    subject: Handlebars.compile(src.subject, { noEscape: true }),
    text: Handlebars.compile(src.text, { noEscape: true }),
    html: src.html
      ? Handlebars.compile(src.html, { noEscape: false })
      : undefined,
  };
  COMPILED.set(name, compiled);
  return compiled;
}

export interface RenderedTemplate {
  subject: string;
  text: string;
  html?: string;
}

export function renderTemplate(
  name: string,
  data: Record<string, unknown>,
): RenderedTemplate {
  const tpl = ensureCompiled(name);
  return {
    subject: tpl.subject(data),
    text: tpl.text(data),
    html: tpl.html?.(data),
  };
}

export function isKnownTemplate(name: string): boolean {
  return name in SOURCES;
}

export const TEMPLATE_NAMES = Object.keys(SOURCES);
