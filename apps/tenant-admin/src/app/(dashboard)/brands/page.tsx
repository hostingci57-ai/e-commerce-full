'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createBrand,
  deleteBrand,
  listBrands,
  updateBrand,
  type BrandListItem,
  type PaginatedResponse,
} from '@/lib/queries';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Input,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import { DataTable, type Column } from '@/components/DataTable';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function BrandsPage() {
  const qc = useQueryClient();
  const brandsQ = useQuery({ queryKey: ['brands'], queryFn: listBrands });

  const [editing, setEditing] = useState<BrandListItem | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items: BrandListItem[] = Array.isArray(brandsQ.data)
    ? brandsQ.data
    : (brandsQ.data as PaginatedResponse<BrandListItem> | undefined)?.items ?? [];

  const openNew = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setOpen(true);
  };
  const openEdit = (b: BrandListItem) => {
    setEditing(b);
    setName(b.name);
    setSlug(b.slug);
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { name, slug: slug || slugify(name) };
      if (editing) return updateBrand(editing.id, payload);
      return createBrand(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Marka güncellendi' : 'Marka eklendi');
      qc.invalidateQueries({ queryKey: ['brands'] });
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => {
      toast.success('Marka silindi');
      qc.invalidateQueries({ queryKey: ['brands'] });
      setConfirmId(null);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    },
  });

  const columns: Column<BrandListItem>[] = [
    { key: 'name', header: 'Marka', render: (r) => r.name },
    { key: 'slug', header: 'Slug', render: (r) => <code className="text-xs">{r.slug}</code> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmId(r.id)}>
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Markalar</h1>
          <p className="mt-1 text-sm text-slate-500">Ürün markalarını yönetin.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Yeni Marka
        </Button>
      </div>

      <Card>
        <CardHeader title={`Toplam ${items.length}`} />
        <CardBody className="p-0">
          <DataTable<BrandListItem>
            rows={items}
            columns={columns}
            rowKey={(r) => r.id}
            loading={brandsQ.isLoading}
            empty="Henüz marka yok."
          />
        </CardBody>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Markayı düzenle' : 'Yeni marka'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Ad" required>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editing) setSlug(slugify(e.target.value));
              }}
            />
          </FormField>
          <FormField label="Slug" required>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </FormField>
        </div>
      </Dialog>

      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Markayı sil"
        description="Bu işlem geri alınamaz."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              loading={delMut.isPending}
              onClick={() => confirmId && delMut.mutate(confirmId)}
            >
              Sil
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Marka silinecek.</p>
      </Dialog>
    </div>
  );
}
