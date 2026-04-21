import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import { CartProvider } from '@/lib/cart-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getBundle, getLocale } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n-context';
import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { getTenantInfo } from '@/lib/tenant-info';

export async function generateMetadata(): Promise<Metadata> {
  const tenantSlug = await getTenantSlug();
  const [settings, info] = await Promise.all([
    api.seo.getSettings({ tenantSlug }).catch(() => null),
    getTenantInfo(),
  ]);
  const shopName = settings?.defaultTitle ?? info.storeName ?? 'ECF Shop';
  const base: Metadata = {
    title: {
      default: shopName,
      template: settings?.titleTemplate?.replace('%shopName', shopName) ?? `%s | ${shopName}`,
    },
    description:
      settings?.defaultDescription ??
      'Çok kiracılı e-ticaret platformu — hızlı, güvenli ve modern alışveriş deneyimi.',
    openGraph: {
      type: 'website',
      siteName: shopName,
      ...(settings?.defaultOgImage ? { images: [{ url: settings.defaultOgImage }] } : {}),
    },
    robots: { index: true, follow: true },
  };
  const verification: Record<string, string> = {};
  if (settings?.googleSiteVerification) verification.google = settings.googleSiteVerification;
  if (settings?.bingSiteVerification) verification.other = settings.bingSiteVerification;
  if (Object.keys(verification).length > 0) {
    base.verification = verification;
  }
  return base;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantSlug = await getTenantSlug();
  const locale = await getLocale();
  const [bundle, availableLocales, info] = await Promise.all([
    getBundle('storefront', locale),
    api.i18n.languages({ tenantSlug }).catch(() => [] as Array<{
      code: string;
      name: string;
      nativeName: string;
      rtl: boolean;
      isDefault: boolean;
    }>),
    getTenantInfo(),
  ]);

  const siteUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: info.storeName ?? 'ECF Shop',
    url: siteUrl,
  };

  return (
    <html lang={locale || info.defaultLanguage || 'tr'}>
      <body className="min-h-screen bg-white text-slate-900">
        <I18nProvider
          locale={locale}
          bundle={bundle}
          availableLocales={availableLocales}
        >
          <QueryProvider>
            <CartProvider>
              <div className="flex min-h-screen flex-col">
                <Header storeName={info.storeName} primaryColor={info.primaryColor} />
                <main className="flex-1">{children}</main>
                <Footer
                  storeName={info.storeName}
                  storeEmail={info.storeEmail}
                  storePhone={info.storePhone}
                  kvkkContact={info.kvkkContact}
                  legalName={info.legalName}
                />
              </div>
            </CartProvider>
          </QueryProvider>
        </I18nProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
      </body>
    </html>
  );
}
