'use client';

import { clsx } from 'clsx';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    Math.min(totalPages, page + 2),
  );

  return (
    <nav className="mt-8 flex items-center justify-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
      >
        Onceki
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={clsx(
            'rounded border px-3 py-1.5',
            p === page
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-300 hover:border-brand-500',
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
      >
        Sonraki
      </button>
    </nav>
  );
}
