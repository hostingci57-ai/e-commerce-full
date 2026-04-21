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

export async function generateMetadata(): Promise<Metadata> {
  const tenantSlug = await getTenantSlug();
  const settings = await api.seo
    .getSettings({ tenantSlug })
    .catch(() => null);
  const base: Metadata = {
    title: {
      default: settings?.defaultTitle ?? 'ECF Shop',
      template: settings?.titleTemplate?.replace('%shopName', 'ECF Shop') ?? '%s | ECF Shop',
    },
    description:
      settings?.defaultDescription ??
      'Çok kiracılı e-ticaret platformu — hızlı, güvenli ve modern alışveriş deneyimi.',
    openGraph: {
      type: 'website',
      siteName: settings?.defaultTitle ?? 'ECF Shop',
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
  const [bundle, availableLocales] = await Promise.all([
    getBundle('storefront', locale),
    api.i18n.languages({ tenantSlug }).catch(() => [] as Array<{
      code: string;
      name: string;
      nativeName: string;
      rtl: boolean;
      isDefault: boolean;
    }>),
  ]);

  // Organization JSON-LD on root — picked up on every page.
  const siteUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ECF Shop',
    url: siteUrl,
  };

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white text-slate-900">
        <I18nProvider
          locale={locale}
          bundle={bundle}
          availableLocales={availableLocales}
        >
          <QueryProvider>
            <CartProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
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
