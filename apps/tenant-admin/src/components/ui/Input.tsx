'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid, className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={clsx(
          'h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2',
          invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200',
          className,
        )}
      />
    );
  },
);
