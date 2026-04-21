import { API_PREFIX, API_URL, DEFAULT_TENANT_SLUG } from './env';
import { getTenantSlug } from './tenant-context';

/**
 * Public tenant info — store name, logo, colors, KVKK contact.
 * Cached 5 minutes via next: { revalidate }.
 * Never throws — if the API is unreachable we fall back to reasonable defaults
 * so the storefront shell can still render.
 */
export interface TenantInfo {
  storeName: string;
  storeEmail: string;
  storePhone: string | null;
  storeAddress: {
    line1?: string;
    line2?: string | null;
    city?: string;
    region?: string | null;
    postalCode?: string | null;
    country?: string;
  } | null;
  currency: string;
  defaultLanguage: string;
  timezone: string;
  logoMediaId: string | null;
  faviconMediaId: string | null;
  primaryColor: string | null;
  kvkkContact: string | null;
  legalName: string | null;
}

const FALLBACK: TenantInfo = {
  storeName: 'ECF Shop',
  storeEmail: 'store@example.com',
  storePhone: null,
  storeAddress: null,
  currency: 'TRY',
  defaultLanguage: 'tr',
  timezone: 'Europe/Istanbul',
  logoMediaId: null,
  faviconMediaId: null,
  primaryColor: '#0ea5e9',
  kvkkContact: null,
  legalName: null,
};

export async function getTenantInfo(): Promise<TenantInfo> {
  const slug = await getTenantSlug();
  try {
    const res = await fetch(`${API_URL}${API_PREFIX}/public/tenant/info`, {
      headers: {
        Accept: 'application/json',
        'X-Tenant-Slug': slug || DEFAULT_TENANT_SLUG,
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return FALLBACK;
    const json = (await res.json()) as Partial<TenantInfo>;
    return { ...FALLBACK, ...json };
  } catch {
    return FALLBACK;
  }
}
