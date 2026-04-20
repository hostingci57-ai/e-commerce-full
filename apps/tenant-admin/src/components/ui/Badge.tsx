import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

type Tone =
  | 'slate'
  | 'blue'
  | 'green'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'cyan'
  | 'orange';

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-800 ring-slate-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  rose: 'bg-rose-100 text-rose-800 ring-rose-200',
  indigo: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  cyan: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  orange: 'bg-orange-100 text-orange-800 ring-orange-200',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({
  tone = 'slate',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
