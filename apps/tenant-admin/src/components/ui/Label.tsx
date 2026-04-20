import type { LabelHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: ReactNode;
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label
      {...props}
      className={clsx(
        'mb-1 block text-sm font-medium text-slate-700',
        className,
      )}
    >
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}
