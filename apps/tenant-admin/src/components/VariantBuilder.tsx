'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';

export interface VariantOption {
  name: string; // e.g., Renk, Beden
  values: string[]; // e.g., ['Kırmızı', 'Mavi']
}

export interface VariantRow {
  combination: Record<string, string>; // { Renk: 'Kırmızı', Beden: 'M' }
  sku: string;
  priceTry: string; // user input in TRY
  stock: number;
}

interface VariantBuilderProps {
  options: VariantOption[];
  rows: VariantRow[];
  onOptionsChange: (options: VariantOption[]) => void;
  onRowsChange: (rows: VariantRow[]) => void;
  basePriceTry?: string;
}

function cartesian(options: VariantOption[]): Record<string, string>[] {
  if (options.length === 0) return [];
  const valid = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (valid.length === 0) return [];
  return valid.reduce<Record<string, string>[]>(
    (acc, opt) => {
      const next: Record<string, string>[] = [];
      for (const row of acc) {
        for (const v of opt.values) {
          next.push({ ...row, [opt.name]: v });
        }
      }
      return next;
    },
    [{}],
  );
}

function comboKey(combo: Record<string, string>): string {
  return Object.entries(combo)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}

export function VariantBuilder({
  options,
  rows,
  onOptionsChange,
  onRowsChange,
  basePriceTry,
}: VariantBuilderProps) {
  const [newValue, setNewValue] = useState<Record<number, string>>({});

  const combinations = useMemo(() => cartesian(options), [options]);

  const syncRows = () => {
    const existing = new Map(rows.map((r) => [comboKey(r.combination), r]));
    const next: VariantRow[] = combinations.map((combo) => {
      const key = comboKey(combo);
      const prev = existing.get(key);
      return (
        prev ?? {
          combination: combo,
          sku: '',
          priceTry: basePriceTry ?? '',
          stock: 0,
        }
      );
    });
    onRowsChange(next);
  };

  const addOption = () => {
    onOptionsChange([...options, { name: '', values: [] }]);
  };

  const removeOption = (idx: number) => {
    const next = options.filter((_, i) => i !== idx);
    onOptionsChange(next);
    setTimeout(syncRows, 0);
  };

  const updateOptionName = (idx: number, name: string) => {
    const next = options.map((o, i) => (i === idx ? { ...o, name } : o));
    onOptionsChange(next);
  };

  const addValue = (idx: number) => {
    const v = (newValue[idx] ?? '').trim();
    if (!v) return;
    const next = options.map((o, i) =>
      i === idx && !o.values.includes(v) ? { ...o, values: [...o.values, v] } : o,
    );
    onOptionsChange(next);
    setNewValue((s) => ({ ...s, [idx]: '' }));
    setTimeout(syncRows, 0);
  };

  const removeValue = (idx: number, v: string) => {
    const next = options.map((o, i) =>
      i === idx ? { ...o, values: o.values.filter((x) => x !== v) } : o,
    );
    onOptionsChange(next);
    setTimeout(syncRows, 0);
  };

  const updateRow = (i: number, patch: Partial<VariantRow>) => {
    onRowsChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {options.map((opt, idx) => (
          <div
            key={idx}
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Seçenek adı</Label>
                <Input
                  value={opt.name}
                  onChange={(e) => updateOptionName(idx, e.target.value)}
                  placeholder="Renk, Beden, Malzeme…"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeOption(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3">
              <Label>Değerler</Label>
              <div className="flex flex-wrap gap-1.5">
                {opt.values.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-slate-200"
                  >
                    {v}
                    <button
                      type="button"
                      onClick={() => removeValue(idx, v)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newValue[idx] ?? ''}
                  onChange={(e) =>
                    setNewValue((s) => ({ ...s, [idx]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addValue(idx);
                    }
                  }}
                  placeholder="Değer ekle"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addValue(idx)}
                >
                  Ekle
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          <Plus className="h-4 w-4" /> Seçenek ekle
        </Button>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Varyant
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SKU
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fiyat (TL)
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stok
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={comboKey(r.combination)}>
                  <td className="px-3 py-2 text-slate-700">
                    {Object.entries(r.combination)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' / ')}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={r.sku}
                      onChange={(e) => updateRow(i, { sku: e.target.value })}
                      placeholder="SKU-001"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={r.priceTry}
                      onChange={(e) =>
                        updateRow(i, { priceTry: e.target.value })
                      }
                      placeholder="199.90"
                      inputMode="decimal"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={r.stock}
                      onChange={(e) =>
                        updateRow(i, { stock: Number(e.target.value) || 0 })
                      }
                      min={0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
