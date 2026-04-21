'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

/**
 * Client-side i18n context. The server layout fetches the bundle once and
 * passes it down via <I18nProvider> — all client components read from the
 * in-memory dictionary, no extra network roundtrips.
 */
export type Bundle = Record<string, string>;

interface I18nShape {
  locale: string;
  bundle: Bundle;
  availableLocales: Array<{
    code: string;
    name: string;
    nativeName: string;
    rtl: boolean;
    isDefault: boolean;
  }>;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nShape | null>(null);

export function I18nProvider({
  children,
  locale,
  bundle,
  availableLocales,
}: {
  children: ReactNode;
  locale: string;
  bundle: Bundle;
  availableLocales: I18nShape['availableLocales'];
}) {
  const t = useCallback(
    (key: string, fallback?: string) => bundle[key] ?? fallback ?? key,
    [bundle],
  );
  const value = useMemo<I18nShape>(
    () => ({ locale, bundle, availableLocales, t }),
    [locale, bundle, availableLocales, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nShape {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Degrade gracefully: key→key when the provider is absent.
    return {
      locale: 'tr',
      bundle: {},
      availableLocales: [],
      t: (k, f) => f ?? k,
    };
  }
  return ctx;
}
