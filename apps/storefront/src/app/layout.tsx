import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import { CartProvider } from '@/lib/cart-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: {
    default: 'ECF Shop',
    template: '%s | ECF Shop',
  },
  description:
    'Cok kiracili e-ticaret platformu — hizli, guvenli ve modern alisveris deneyimi.',
  openGraph: {
    type: 'website',
    siteName: 'ECF Shop',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-white text-slate-900">
        <QueryProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </CartProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
