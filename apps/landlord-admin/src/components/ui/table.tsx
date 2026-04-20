import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm', className)}>
      <table className="min-w-full divide-y divide-gray-200">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }): JSX.Element {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }): JSX.Element {
  return <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>;
}

export function TR({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <tr className={cn('hover:bg-gray-50', className)}>{children}</tr>;
}

export function TH({ children, className }: { children?: ReactNode; className?: string }): JSX.Element {
  return (
    <th
      scope="col"
      className={cn('px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500', className)}
    >
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <td className={cn('whitespace-nowrap px-4 py-3 text-sm text-gray-800', className)}>{children}</td>;
}
