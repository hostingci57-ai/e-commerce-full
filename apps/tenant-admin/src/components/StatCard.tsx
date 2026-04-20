import type { ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; positive: boolean };
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
          {delta ? (
            <p
              className={clsx(
                'mt-1 text-xs font-medium',
                delta.positive ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {delta.positive ? '↑' : '↓'} {delta.value}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
