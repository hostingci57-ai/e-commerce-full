import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-5xl font-bold text-slate-900">404</h1>
      <p className="text-slate-600">Aradiginiz sayfa bulunamadi.</p>
      <Link
        href="/"
        className="rounded-md bg-brand-600 px-6 py-2 font-medium text-white hover:bg-brand-700"
      >
        Anasayfaya Don
      </Link>
    </div>
  );
}
