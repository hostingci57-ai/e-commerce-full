import Link from 'next/link';

interface FooterProps {
  storeName?: string;
  storeEmail?: string;
  storePhone?: string | null;
  kvkkContact?: string | null;
  legalName?: string | null;
}

export function Footer({
  storeName = 'ECF Shop',
  storeEmail,
  storePhone,
  kvkkContact,
  legalName,
}: FooterProps) {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="container grid grid-cols-2 gap-8 py-10 text-sm md:grid-cols-4">
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">{storeName}</h4>
          <p className="text-slate-600">
            Cok kiracili e-ticaret platformu. Basit, hizli, guvenli.
          </p>
          {storeEmail ? (
            <p className="mt-2 text-slate-600">
              <a href={`mailto:${storeEmail}`} className="hover:text-brand-700">
                {storeEmail}
              </a>
            </p>
          ) : null}
          {storePhone ? (
            <p className="text-slate-600">
              <a href={`tel:${storePhone}`} className="hover:text-brand-700">
                {storePhone}
              </a>
            </p>
          ) : null}
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
            {kvkkContact ? (
              <li>
                <a href={`mailto:${kvkkContact}`} className="hover:text-brand-700">
                  KVKK: {kvkkContact}
                </a>
              </li>
            ) : null}
            <li><a href="#">Gizlilik</a></li>
            <li><a href="#">Iade Kosullari</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        (c) {new Date().getFullYear()} {legalName ?? storeName}
      </div>
    </footer>
  );
}
