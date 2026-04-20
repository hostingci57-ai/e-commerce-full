import { NextResponse, type NextRequest } from 'next/server';

/**
 * Tenant detection middleware.
 *
 * Extracts the tenant slug from subdomain (e.g. `acme.platform.local`),
 * falling back to `NEXT_PUBLIC_TENANT_SLUG`. The resolved slug is
 * propagated to all internal fetches via the `x-tenant-slug` request
 * header, which Server Components read through `getTenantSlug()`.
 *
 * MVP: single-tenant mode is the default (demo slug).
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const hostname = host.split(':')[0];

  let slug = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'demo';

  // subdomain parse: pick up `<slug>.localhost` or `<slug>.platform.local`
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const head = parts[0];
    const reserved = new Set(['www', 'api', 'admin', 'localhost', '127']);
    if (head && !reserved.has(head) && head.length >= 2) {
      slug = head;
    }
  }

  const headers = new Headers(req.headers);
  headers.set('x-tenant-slug', slug);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // skip static assets + next internals
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)).*)',
  ],
};
