'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  getCmsMenu,
  updateCmsMenu,
  type CmsMenuItem,
} from '@/lib/queries';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
} from '@/components/ui';
import { FormField } from '@/components/FormField';

export const dynamic = 'force-dynamic';

const MENU_KEYS = [
  { key: 'main', label: 'Ana Menü (Header)' },
  { key: 'footer', label: 'Footer' },
];

export default function MenusPage() {
  const qc = useQueryClient();
  const [activeKey, setActiveKey] = useState('main');
  const [items, setItems] = useState<CmsMenuItem[]>([]);
  const [name, setName] = useState('');

  const menuQ = useQuery({
    queryKey: ['cms-menu', activeKey],
    queryFn: () => getCmsMenu(activeKey),
    retry: false,
  });

  useEffect(() => {
    if (menuQ.data) {
      setItems(menuQ.data.items ?? []);
      setName(menuQ.data.name);
    } else if (menuQ.error) {
      // Menu doesn't exist yet — start fresh.
      setItems([]);
      setName(activeKey);
    }
  }, [menuQ.data, menuQ.error, activeKey]);

  const saveMut = useMutation({
    mutationFn: () => updateCmsMenu(activeKey, { name, items }),
    onSuccess: () => {
      toast.success('Menü kaydedildi');
      qc.invalidateQueries({ queryKey: ['cms-menu', activeKey] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız'),
  });

  const updateItem = (idx: number, patch: Partial<CmsMenuItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((it, i) => ({ ...it, sortOrder: i * 10 }));
    });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { label: 'Yeni bağlantı', type: 'url', target: '/', sortOrder: prev.length * 10 },
    ]);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Menüler</h1>
        <p className="mt-1 text-sm text-slate-500">
          Storefront header ve footer menülerini düzenleyin.
        </p>
      </div>

      <div className="flex gap-2">
        {MENU_KEYS.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveKey(m.key)}
            className={
              'rounded-md border px-3 py-1.5 text-sm ' +
              (activeKey === m.key
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`Menü: ${activeKey}`}
          description="Sıra yukarıdan aşağıya ekranda görünecek sıradır."
          action={
            <Button size="sm" onClick={() => addItem()}>
              <Plus className="mr-1 h-3 w-3" />
              Ekle
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <FormField label="Menü adı">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <div className="col-span-1 flex flex-col gap-1">
                  <button
                    className="text-slate-500 hover:text-slate-900"
                    onClick={() => moveItem(idx, -1)}
                    aria-label="Yukarı taşı"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    className="text-slate-500 hover:text-slate-900"
                    onClick={() => moveItem(idx, 1)}
                    aria-label="Aşağı taşı"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="col-span-3">
                  <Input
                    value={item.label}
                    placeholder="Etiket"
                    onChange={(e) => updateItem(idx, { label: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    value={item.type}
                    onChange={(e) =>
                      updateItem(idx, { type: e.target.value as CmsMenuItem['type'] })
                    }
                  >
                    <option value="url">URL</option>
                    <option value="page">Sayfa (slug)</option>
                    <option value="category">Kategori (slug)</option>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    value={item.target}
                    placeholder={
                      item.type === 'url'
                        ? '/products'
                        : item.type === 'page'
                          ? 'hakkimizda'
                          : 'elektronik'
                    }
                    onChange={(e) => updateItem(idx, { target: e.target.value })}
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-red-600 hover:text-red-700"
                    aria-label="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Bu menüde henüz öğe yok.
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMut.mutate()}
              loading={saveMut.isPending}
              disabled={!name.trim()}
            >
              Kaydet
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
