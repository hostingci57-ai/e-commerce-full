import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ECF Landlord Admin',
  description: 'Platform landlord panel',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
