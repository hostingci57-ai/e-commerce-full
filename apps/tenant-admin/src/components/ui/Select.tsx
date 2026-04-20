'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid, className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        {...props}
        className={clsx(
          'h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm outline-none transition focus:ring-2',
          invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200',
          className,
        )}
      >
        {children}
      </select>
    );
  },
);
