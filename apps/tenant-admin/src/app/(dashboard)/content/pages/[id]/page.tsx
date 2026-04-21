'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Card, CardBody, CardHeader, Input, Textarea } from '@/components/ui';
import { FormField } from '@/components/FormField';
import { getCmsPage, updateCmsPage } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function EditCmsPagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const pageQ = useQuery({
    queryKey: ['cms-page', params.id],
    queryFn: () => getCmsPage(params.id),
    enabled: !!params.id,
  });

  const [form, setForm] = useState({
    slug: '',
    title: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    showInFooter: false,
    showInHeader: false,
    isPublished: false,
  });

  useEffect(() => {
    if (pageQ.data) {
      setForm({
        slug: pageQ.data.slug,
        title: pageQ.data.title,
        content: pageQ.data.content,
        metaTitle: pageQ.data.metaTitle ?? '',
        metaDescription: pageQ.data.metaDescription ?? '',
        showInFooter: pageQ.data.showInFooter,
        showInHeader: pageQ.data.showInHeader,
        isPublished: pageQ.data.isPublished,
      });
    }
  }, [pageQ.data]);

  const updateMut = useMutation({
    mutationFn: () =>
      updateCmsPage(params.id, {
        slug: form.slug.trim(),
        title: form.title.trim(),
        content: form.content,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        showInFooter: form.showInFooter,
        showInHeader: form.showInHeader,
        isPublished: form.isPublished,
      }),
    onSuccess: () => {
      toast.success('Kaydedildi');
      qc.invalidateQueries({ queryKey: ['cms-pages'] });
      qc.invalidateQueries({ queryKey: ['cms-page', params.id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız'),
  });

  if (pageQ.isLoading) {
    return <div className="p-6 text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (pageQ.isError) {
    return <div className="p-6 text-sm text-red-600">Sayfa yüklenemedi.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Sayfayı Düzenle: {form.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">/p/{form.slug}</p>
      </div>

      <Card>
        <CardHeader title="Temel Bilgiler" />
        <CardBody className="space-y-4">
          <FormField label="Başlık">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FormField>
          <FormField label="Slug">
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm({
                  ...form,
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, '-')
                    .replace(/-+/g, '-'),
                })
              }
            />
          </FormField>
          <FormField label="İçerik (Markdown)">
            <Textarea
              rows={16}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="SEO" />
        <CardBody className="space-y-4">
          <FormField label="Meta Title">
            <Input
              value={form.metaTitle}
              onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
            />
          </FormField>
          <FormField label="Meta Description">
            <Textarea
              rows={3}
              value={form.metaDescription}
              onChange={(e) =>
                setForm({ ...form, metaDescription: e.target.value })
              }
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Yayın" />
        <CardBody className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            Yayında
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.showInFooter}
              onChange={(e) => setForm({ ...form, showInFooter: e.target.checked })}
            />
            Footer'da göster
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.showInHeader}
              onChange={(e) => setForm({ ...form, showInHeader: e.target.checked })}
            />
            Header'da göster
          </label>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push('/content/pages')}>
          Geri
        </Button>
        <Button loading={updateMut.isPending} onClick={() => updateMut.mutate()}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}
