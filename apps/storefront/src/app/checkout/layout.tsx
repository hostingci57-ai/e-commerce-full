import { CheckoutStepIndicator } from '@/components/CheckoutStepIndicator';
import { headers } from 'next/headers';

export const metadata = { title: 'Odeme' };

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  // Next provides url via x-invoke-path in most runtimes; fallback to pathname in child page
  const pathname = h.get('x-invoke-path') ?? h.get('x-pathname') ?? '';

  let current: 'address' | 'shipping' | 'payment' = 'address';
  if (pathname.includes('/shipping')) current = 'shipping';
  else if (pathname.includes('/payment')) current = 'payment';

  const isThankYou = pathname.includes('/thank-you');

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Odeme</h1>
      {!isThankYou ? <CheckoutStepIndicator current={current} /> : null}
      {children}
    </div>
  );
}
