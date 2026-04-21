import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import { CartProvider } from '@/lib/cart-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getTenantInfo } from '@/lib/tenant-info';

export async function generateMetadata(): Promise<Metadata> {
  const info = await getTenantInfo();
  return {
    title: {
      default: info.storeName,
      template: `%s | ${info.storeName}`,
    },
    description:
      'Cok kiracili e-ticaret platformu — hizli, guvenli ve modern alisveris deneyimi.',
    openGraph: {
      type: 'website',
      siteName: info.storeName,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const info = await getTenantInfo();
  return (
    <html lang={info.defaultLanguage || 'tr'}>
      <body className="min-h-screen bg-white text-slate-900">
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
      </body>
    </html>
  );
}
