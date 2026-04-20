import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-lg border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-slate-900">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
