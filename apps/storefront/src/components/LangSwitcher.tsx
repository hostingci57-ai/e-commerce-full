'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useI18n } from '@/lib/i18n-context';

/**
 * Language switcher — sets the NEXT_LOCALE cookie + refreshes the RSC tree.
 * Keeps MVP scope tight: no URL route prefix (would require deep refactor of
 * every `app/...` file). Cookie + refresh covers all SSR + client reads.
 */
export function LangSwitcher({ className }: { className?: string }) {
  const { locale, availableLocales } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (availableLocales.length <= 1) return null;

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    // 1-year cookie, lax so it flows on internal navigation.
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <select
      aria-label="Dil seçimi"
      className={
        className ??
        'rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-brand-500 focus:outline-none'
      }
      value={locale}
      onChange={onChange}
      disabled={pending}
    >
      {availableLocales.map((l) => (
        <option key={l.code} value={l.code}>
          {l.nativeName}
        </option>
      ))}
    </select>
  );
}
