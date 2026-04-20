import Link from 'next/link';

export const metadata = { title: 'Hesabim' };

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Hesabim</h1>
      <div className="grid gap-8 lg:grid-cols-4">
        <aside className="space-y-1 text-sm lg:col-span-1">
          <Link
            href="/account/orders"
            className="block rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            Siparislerim
          </Link>
          <Link
            href="/account/addresses"
            className="block rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            Adreslerim
          </Link>
          <Link
            href="/account/profile"
            className="block rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            Profil / KVKK
          </Link>
        </aside>
        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}
