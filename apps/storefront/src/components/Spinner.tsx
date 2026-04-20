import { clsx } from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600',
        className,
      )}
      role="status"
      aria-label="loading"
    />
  );
}
