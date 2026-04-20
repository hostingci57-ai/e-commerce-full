/**
 * Money: backend returns values in kuruş (smallest unit, bigint-safe string).
 * UI displays TRY.
 */
export function formatMoney(
  valueInMinor: number | string | bigint | null | undefined,
  currency: string = 'TRY',
  locale: string = 'tr-TR',
): string {
  if (valueInMinor === null || valueInMinor === undefined) return '-';
  const n =
    typeof valueInMinor === 'bigint'
      ? Number(valueInMinor)
      : typeof valueInMinor === 'string'
        ? Number(valueInMinor)
        : valueInMinor;
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n / 100);
}

/** TRY string (e.g. "199.90") → kuruş integer (19990). */
export function parseTryToKurus(input: string): number {
  const normalized = input.replace(',', '.').trim();
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: string = 'tr-TR',
): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string = 'tr-TR',
): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
