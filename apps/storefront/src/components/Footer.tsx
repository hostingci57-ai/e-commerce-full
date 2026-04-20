import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="container grid grid-cols-2 gap-8 py-10 text-sm md:grid-cols-4">
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">ECF Shop</h4>
          <p className="text-slate-600">
            Cok kiracili e-ticaret platformu. Basit, hizli, guvenli.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Magaza</h4>
          <ul className="space-y-1 text-slate-600">
            <li><Link href="/products">Tum Urunler</Link></li>
            <li><Link href="/c/electronics">Elektronik</Link></li>
            <li><Link href="/c/fashion">Moda</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Hesap</h4>
          <ul className="space-y-1 text-slate-600">
            <li><Link href="/login">Giris</Link></li>
            <li><Link href="/register">Uye Ol</Link></li>
            <li><Link href="/account/orders">Siparislerim</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Yasal</h4>
          <ul className="space-y-1 text-slate-600">
            <li><Link href="/account/profile">KVKK</Link></li>
            <li><a href="#">Gizlilik</a></li>
            <li><a href="#">Iade Kosullari</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        (c) {new Date().getFullYear()} ECF Shop
      </div>
    </footer>
  );
}
