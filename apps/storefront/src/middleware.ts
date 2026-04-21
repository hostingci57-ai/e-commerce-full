import { NextResponse, type NextRequest } from 'next/server';

/**
 * Tenant detection + redirect check middleware.
 *
 * 1. Resolve tenant slug from subdomain (falls back to NEXT_PUBLIC_TENANT_SLUG).
 * 2. Ask the API for a redirect matching the current path — Redis-cached on the
 *    API side (TTL 5 min) so the hot path is cheap. When a redirect is found,
 *    we short-circuit with the API-provided status code (301/302/307/308).
 * 3. Forward the resolved slug downstream via `x-tenant-slug`.
 *
 * MVP: single-tenant mode is the default (demo slug).
 */
export async function middleware(req: NextRequest) {
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

  // Only check redirects for navigable GET requests; skip API proxies, assets
  // (handled by matcher anyway) and any non-idempotent method.
  if (req.method === 'GET') {
    const redirect = await lookupRedirect(req.nextUrl.pathname, slug);
    if (redirect) {
      const url = req.nextUrl.clone();
      // toPath can be an absolute path (/foo) or absolute URL.
      if (/^https?:\/\//.test(redirect.redirect)) {
        return NextResponse.redirect(redirect.redirect, redirect.status);
      }
      url.pathname = redirect.redirect;
      return NextResponse.redirect(url, redirect.status);
    }
  }

  const headers = new Headers(req.headers);
  headers.set('x-tenant-slug', slug);

  return NextResponse.next({ request: { headers } });
}

async function lookupRedirect(
  path: string,
  tenantSlug: string,
): Promise<{ redirect: string; status: number } | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 400);
    const res = await fetch(
      `${apiUrl}/v1/public/redirects/check?path=${encodeURIComponent(path)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Tenant-Subdomain': tenantSlug,
        },
        signal: controller.signal,
        // Edge runtime has no `next` cache; revalidate=0 keeps behaviour consistent.
        cache: 'no-store',
      },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      redirect: string | null;
      status: number | null;
    };
    if (!data.redirect || !data.status) return null;
    const status =
      data.status === 301 ||
      data.status === 302 ||
      data.status === 307 ||
      data.status === 308
        ? data.status
        : 301;
    return { redirect: data.redirect, status };
  } catch {
    // Redirect lookup is best-effort: any failure falls through to normal routing.
    return null;
  }
}

export const config = {
  matcher: [
    // skip static assets + next internals
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|xml|txt)).*)',
  ],
};
