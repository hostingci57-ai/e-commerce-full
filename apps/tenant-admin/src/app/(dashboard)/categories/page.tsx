'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createCategory,
  deleteCategory,
  getCategoryTree,
  listCategories,
  updateCategory,
  type CategoryListItem,
} from '@/lib/queries';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Input,
  Select,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import { CategoryTree, type CategoryNode } from '@/components/CategoryTree';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function CategoriesPage() {
  const qc = useQueryClient();

  const flatQ = useQuery({ queryKey: ['categories', 'list'], queryFn: listCategories });
  const treeQ = useQuery({ queryKey: ['categories', 'tree'], queryFn: getCategoryTree });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryListItem | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const flat = flatQ.data ?? [];
  const tree = useMemo<CategoryNode[]>(
    () => (treeQ.data ?? []) as unknown as CategoryNode[],
    [treeQ.data],
  );

  const openNew = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setParentId('');
    setOpen(true);
  };
  const openEdit = (c: CategoryListItem) => {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setParentId(c.parentId ?? '');
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        slug: slug || slugify(name),
        parentId: parentId || null,
      };
      if (editing) return updateCategory(editing.id, payload);
      return createCategory(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Kategori güncellendi' : 'Kategori eklendi');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      toast.success('Kategori silindi');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setConfirmId(null);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    },
  });

  const findFlat = (id: string) => flat.find((c) => c.id === id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kategoriler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ürün kategorilerini ve hiyerarşilerini yönetin.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Yeni Kategori
        </Button>
      </div>

      <Card>
        <CardHeader title="Kategori ağacı" />
        <CardBody className="p-0">
          {treeQ.isLoading ? (
            <div className="p-4 text-sm text-slate-500">Yükleniyor…</div>
          ) : tree.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Henüz kategori yok.</div>
          ) : (
            <CategoryTree
              nodes={tree}
              renderRowActions={(n) => (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const fromFlat = findFlat(n.id);
                      if (fromFlat) openEdit(fromFlat);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmId(n.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </>
              )}
            />
          )}
        </CardBody>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Kategoriyi düzenle' : 'Yeni kategori'}
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
          <FormField label="Üst kategori">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Kök —</option>
              {flat
                .filter((c) => !editing || c.id !== editing.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </FormField>
        </div>
      </Dialog>

      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Kategoriyi sil"
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
        <p className="text-sm text-slate-600">
          Kategori ve alt kategorileri etkilenebilir.
        </p>
      </Dialog>
    </div>
  );
}
