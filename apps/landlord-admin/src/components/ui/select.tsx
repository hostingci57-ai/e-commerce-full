'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, id, children, ...rest },
  ref,
) {
  const selectId = id ?? rest.name;
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        ref={ref}
        className={cn(
          'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
          'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
});
