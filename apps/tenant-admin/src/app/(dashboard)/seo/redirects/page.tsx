'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Upload } from 'lucide-react';
import {
  createRedirect,
  deleteRedirect,
  importRedirects,
  listRedirects,
  updateRedirect,
  type RedirectItem,
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

export default function RedirectsAdminPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [newRow, setNewRow] = useState({
    fromPath: '',
    toPath: '',
    statusCode: 301 as 301 | 302 | 307 | 308,
    isActive: true,
  });

  const q = useQuery({
    queryKey: ['redirects'],
    queryFn: () => listRedirects({ limit: 500 }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createRedirect({
        fromPath: newRow.fromPath.trim(),
        toPath: newRow.toPath.trim(),
        statusCode: newRow.statusCode,
        isActive: newRow.isActive,
      }),
    onSuccess: () => {
      toast.success('Yönlendirme eklendi');
      qc.invalidateQueries({ queryKey: ['redirects'] });
      setNewRow({ fromPath: '', toPath: '', statusCode: 301, isActive: true });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Eklenemedi'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RedirectItem> }) =>
      updateRedirect(id, patch),
    onSuccess: () => {
      toast.success('Güncellendi');
      qc.invalidateQueries({ queryKey: ['redirects'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRedirect(id),
    onSuccess: () => {
      toast.success('Silindi');
      qc.invalidateQueries({ queryKey: ['redirects'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Silinemedi'),
  });

  const importMut = useMutation({
    mutationFn: (csv: string) => importRedirects(csv, true),
    onSuccess: (res) => {
      toast.success(
        `İçe aktarıldı (yeni: ${res.created}, güncelleme: ${res.updated}${
          res.errors.length > 0 ? `, hata: ${res.errors.length}` : ''
        })`,
      );
      qc.invalidateQueries({ queryKey: ['redirects'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'İçe aktarım başarısız'),
  });

  const handleFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    importMut.mutate(text);
  };

  const exportCsv = () => {
    const rows = q.data ?? [];
    const csv =
      'from,to,status\n' +
      rows
        .map((r) => [r.fromPath, r.toPath, r.statusCode].join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redirects.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const items = q.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Yönlendirmeler</h1>
        <p className="mt-1 text-sm text-slate-500">
          Eski URL'leri yeni adreslere 301/302 ile yönlendirin.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Yeni Yönlendirme"
          description="Başında '/' olmalı"
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1 h-3 w-3" />
                CSV İçe Aktar
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                CSV Dışa Aktar
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          }
        />
        <CardBody className="grid grid-cols-12 items-end gap-2">
          <div className="col-span-4">
            <FormField label="Eski Yol">
              <Input
                placeholder="/eski-sayfa"
                value={newRow.fromPath}
                onChange={(e) => setNewRow({ ...newRow, fromPath: e.target.value })}
              />
            </FormField>
          </div>
          <div className="col-span-4">
            <FormField label="Yeni Yol">
              <Input
                placeholder="/yeni-sayfa"
                value={newRow.toPath}
                onChange={(e) => setNewRow({ ...newRow, toPath: e.target.value })}
              />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Status">
              <Select
                value={newRow.statusCode}
                onChange={(e) =>
                  setNewRow({
                    ...newRow,
                    statusCode: Number.parseInt(e.target.value, 10) as 301 | 302 | 307 | 308,
                  })
                }
              >
                <option value={301}>301</option>
                <option value={302}>302</option>
                <option value={307}>307</option>
                <option value={308}>308</option>
              </Select>
            </FormField>
          </div>
          <div className="col-span-2">
            <Button
              className="w-full"
              onClick={() => createMut.mutate()}
              disabled={!newRow.fromPath.trim() || !newRow.toPath.trim()}
              loading={createMut.isPending}
            >
              <Plus className="mr-1 h-3 w-3" />
              Ekle
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${items.length} yönlendirme`} />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eski
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Yeni
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Durum
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Aktif
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-800">
                    {r.fromPath}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    {r.toPath}
                  </td>
                  <td className="px-4 py-2 text-xs">{r.statusCode}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={(e) =>
                        updateMut.mutate({ id: r.id, patch: { isActive: e.target.checked } })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`${r.fromPath} silinsin mi?`)) deleteMut.mutate(r.id);
                      }}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !q.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Henüz yönlendirme yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
