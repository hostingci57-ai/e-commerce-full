'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface TabsContextValue {
  active: string;
  setActive: (v: string) => void;
}

const Ctx = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const active = value ?? internal;
  const setActive = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };
  return (
    <Ctx.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        'flex gap-1 rounded-md bg-slate-100 p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs');
  const isActive = ctx.active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.setActive(value)}
      className={clsx(
        'inline-flex h-8 items-center justify-center rounded px-3 text-sm font-medium transition',
        isActive
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900',
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('TabsContent must be used within Tabs');
  if (ctx.active !== value) return null;
  return <div className={clsx('mt-4', className)}>{children}</div>;
}
