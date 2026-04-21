import Link from 'next/link';
import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { getString } from '@/lib/i18n';

/**
 * Footer is a Server Component so we can SSR the CMS-driven columns.
 * - Column "Yasal": CMS pages flagged showInFooter=true, ordered by sortOrder
 * - Column "Magaza": static links (products + categories)
 * - Column "Hesap": auth / account links
 */
export async function Footer() {
  const tenantSlug = await getTenantSlug();

  const [pages, label] = await Promise.all([
    api.cms.listPages('footer', { tenantSlug }).catch(
      () =>
        [] as Array<{
          id: string;
          slug: string;
          title: string;
          sortOrder: number;
        }>,
    ),
    (async () => ({
      store: await getString('nav.products'),
      orders: await getString('nav.orders'),
      login: await getString('nav.login'),
      register: await getString('nav.register'),
    }))(),
  ]);

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="container grid grid-cols-2 gap-8 py-10 text-sm md:grid-cols-4">
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">ECF Shop</h4>
          <p className="text-slate-600">
            Çok kiracılı e-ticaret platformu. Basit, hızlı, güvenli.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Mağaza</h4>
          <ul className="space-y-1 text-slate-600">
            <li>
              <Link href="/products">{label.store}</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Hesap</h4>
          <ul className="space-y-1 text-slate-600">
            <li>
              <Link href="/login">{label.login}</Link>
            </li>
            <li>
              <Link href="/register">{label.register}</Link>
            </li>
            <li>
              <Link href="/account/orders">{label.orders}</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Yasal</h4>
          <ul className="space-y-1 text-slate-600">
            {pages.length > 0 ? (
              pages.map((p) => (
                <li key={p.id}>
                  <Link href={`/p/${p.slug}`}>{p.title}</Link>
                </li>
              ))
            ) : (
              <li className="text-slate-400">—</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        (c) {new Date().getFullYear()} ECF Shop
      </div>
    </footer>
  );
}
