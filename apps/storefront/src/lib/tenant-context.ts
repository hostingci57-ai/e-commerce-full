import { headers } from 'next/headers';
import { DEFAULT_TENANT_SLUG } from './env';

/**
 * Resolve the current tenant slug on the server.
 * Priority: X-Tenant-Slug header (set by middleware) → env fallback.
 * Works in Server Components / Route Handlers.
 */
export async function getTenantSlug(): Promise<string> {
  try {
    const h = await headers();
    const fromHeader = h.get('x-tenant-slug');
    if (fromHeader) return fromHeader;
  } catch {
    /* headers() unavailable outside request scope */
  }
  return DEFAULT_TENANT_SLUG;
}
