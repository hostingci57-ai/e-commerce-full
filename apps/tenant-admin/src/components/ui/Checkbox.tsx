'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className, ...props }, ref) {
    return (
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          ref={ref}
          type="checkbox"
          {...props}
          className={clsx(
            'h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500',
            className,
          )}
        />
        {label ? <span>{label}</span> : null}
      </label>
    );
  },
);
