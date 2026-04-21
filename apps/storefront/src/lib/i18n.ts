import { cookies } from 'next/headers';
import { api } from './api';
import { getTenantSlug } from './tenant-context';

/**
 * i18n engine for the storefront.
 *
 * Locale resolution (server-side):
 *   1. `NEXT_LOCALE` cookie (set by the LangSwitcher)
 *   2. First tenant default language from GET /v1/public/i18n/languages
 *   3. Fallback constant `tr`
 *
 * Bundle fetch:
 *   - Hits `GET /v1/public/i18n/bundle?lang=&ns=` (Redis-cached on the API for
 *     5 min). Revalidate is wired to the same 300s window so Next's fetch cache
 *     plus the backend Redis cache keep the fast path purely in-memory.
 *   - On any failure we return an empty dict; downstream `getString` treats a
 *     missing key as a pass-through of the key itself.
 */
const FALLBACK_LOCALE = 'tr';
const LOCALE_COOKIE = 'NEXT_LOCALE';

export type Bundle = Record<string, string>;

export async function getLocale(): Promise<string> {
  try {
    const c = await cookies();
    const v = c.get(LOCALE_COOKIE)?.value;
    if (v && /^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(v)) return v.toLowerCase();
  } catch {
    /* outside request scope */
  }
  try {
    const tenantSlug = await getTenantSlug();
    const langs = await api.i18n.languages({ tenantSlug });
    const def = langs.find((l) => l.isDefault);
    if (def) return def.code;
    if (langs[0]) return langs[0].code;
  } catch {
    /* ignore */
  }
  return FALLBACK_LOCALE;
}

export async function getBundle(
  ns = 'storefront',
  lang?: string,
): Promise<Bundle> {
  const tenantSlug = await getTenantSlug();
  const locale = lang ?? (await getLocale());
  try {
    const res = await api.i18n.bundle(locale, ns, { tenantSlug });
    return res.strings;
  } catch {
    return {};
  }
}

/**
 * Server-side translator. For client components use the `useI18n` hook with
 * a bundle pre-loaded in a context.
 */
export async function getString(key: string, ns = 'storefront'): Promise<string> {
  const b = await getBundle(ns);
  return b[key] ?? key;
}

export const LOCALE_COOKIE_NAME = LOCALE_COOKIE;
