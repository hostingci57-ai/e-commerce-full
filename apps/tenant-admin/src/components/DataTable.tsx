'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  sort?: { key: string; direction: 'asc' | 'desc' };
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  sort,
  onSortChange,
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <THead>
          <tr>
            {columns.map((c) => (
              <TH key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.sortable && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => onSortChange(c.key)}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.direction === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {loading ? (
            <tr>
              <TD colSpan={columns.length} className="py-10 text-center text-slate-500">
                Yükleniyor…
              </TD>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <TD colSpan={columns.length} className="py-10 text-center text-slate-500">
                {empty ?? 'Kayıt bulunamadı.'}
              </TD>
            </tr>
          ) : (
            rows.map((r) => (
              <TR
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={clsx(onRowClick && 'cursor-pointer')}
              >
                {columns.map((c) => (
                  <TD key={c.key} className={c.className}>
                    {c.render(r)}
                  </TD>
                ))}
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {pagination && pagination.total > 0 ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <div className="text-slate-600">
            Toplam <span className="font-medium">{pagination.total}</span> kayıt
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="rounded border border-slate-300 px-2.5 py-1 disabled:opacity-50"
            >
              Önceki
            </button>
            <span className="text-slate-600">
              {pagination.page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="rounded border border-slate-300 px-2.5 py-1 disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
