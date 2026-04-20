import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warn' | 'danger' | 'muted';

const TONES: Record<Tone, string> = {
  default: 'bg-brand-50 text-brand-700 ring-brand-500/20',
  success: 'bg-green-50 text-green-700 ring-green-500/20',
  warn: 'bg-amber-50 text-amber-700 ring-amber-500/20',
  danger: 'bg-red-50 text-red-700 ring-red-500/20',
  muted: 'bg-gray-100 text-gray-700 ring-gray-500/10',
};

export function Badge({
  tone = 'default',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function tenantStatusTone(status: string): Tone {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'default';
    case 'suspended':
      return 'warn';
    case 'cancelled':
      return 'muted';
    case 'deleted':
      return 'danger';
    default:
      return 'muted';
  }
}
