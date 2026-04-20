import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }): JSX.Element {
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', className)}>{children}</div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={cn('border-b border-gray-200 px-5 py-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <h2 className={cn('text-base font-semibold text-gray-900', className)}>{children}</h2>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
