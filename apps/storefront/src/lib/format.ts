export function formatPrice(
  amount: number,
  currency: string = 'TRY',
  locale: string = 'tr-TR',
): string {
  // backend stores minor units; divide by 100 for display
  const value = (amount ?? 0) / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDate(
  iso: string,
  locale: string = 'tr-TR',
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
