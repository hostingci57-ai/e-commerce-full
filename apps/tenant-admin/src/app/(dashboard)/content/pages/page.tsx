'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  deleteCmsPage,
  listCmsPages,
  publishCmsPage,
  unpublishCmsPage,
  type CmsPageItem,
} from '@/lib/queries';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function CmsPagesPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['cms-pages'],
    queryFn: () => listCmsPages({ limit: 100 }),
  });

  const publishMut = useMutation({
    mutationFn: (p: CmsPageItem) =>
      p.isPublished ? unpublishCmsPage(p.id) : publishCmsPage(p.id),
    onSuccess: () => {
      toast.success('Güncellendi');
      qc.invalidateQueries({ queryKey: ['cms-pages'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Güncelleme başarısız'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCmsPage(id),
    onSuccess: () => {
      toast.success('Sayfa silindi');
      qc.invalidateQueries({ queryKey: ['cms-pages'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Silme başarısız'),
  });

  const items = q.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sayfalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hakkımızda, Gizlilik, KVKK gibi statik sayfaları düzenleyin.
          </p>
        </div>
        <Link
          href="/content/pages/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Yeni Sayfa
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Tüm Sayfalar"
          description={q.isLoading ? 'Yükleniyor…' : `${items.length} sayfa`}
        />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Başlık
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Slug
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Durum
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Konum
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{p.title}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">/p/{p.slug}</td>
                  <td className="px-4 py-2">
                    {p.isPublished ? (
                      <Badge tone="green">Yayında</Badge>
                    ) : (
                      <Badge tone="slate">Taslak</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {[p.showInHeader ? 'Header' : null, p.showInFooter ? 'Footer' : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => publishMut.mutate(p)}
                        disabled={publishMut.isPending}
                      >
                        {p.isPublished ? 'Kaldır' : 'Yayınla'}
                      </Button>
                      <Link
                        href={`/content/pages/${p.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3 w-3" />
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`"${p.title}" silinsin mi?`)) deleteMut.mutate(p.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !q.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Henüz sayfa yok.
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
