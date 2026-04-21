'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Card, CardBody, CardHeader, Input, Textarea } from '@/components/ui';
import { FormField } from '@/components/FormField';
import { createCmsPage } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function NewCmsPagePage() {
  const router = useRouter();
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

  const createMut = useMutation({
    mutationFn: () =>
      createCmsPage({
        slug: form.slug.trim(),
        title: form.title.trim(),
        content: form.content,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        showInFooter: form.showInFooter,
        showInHeader: form.showInHeader,
        isPublished: form.isPublished,
      }),
    onSuccess: (row) => {
      toast.success('Sayfa oluşturuldu');
      router.push(`/content/pages/${row.id}`);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı'),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Yeni Sayfa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Markdown destekli içerik yazın. Yayınlandığında <code>/p/&lt;slug&gt;</code> altında görünür.
        </p>
      </div>

      <Card>
        <CardHeader title="Temel Bilgiler" />
        <CardBody className="space-y-4">
          <FormField label="Başlık" hint="Örn: Hakkımızda">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FormField>
          <FormField label="Slug" hint="URL içindeki yol — sadece küçük harf / tire">
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
          <FormField label="İçerik (Markdown)" hint="Başlıklar # ##, listeler -, bağlantılar [metin](url)">
            <Textarea
              rows={12}
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
            Yayınla
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
          Vazgeç
        </Button>
        <Button
          loading={createMut.isPending}
          onClick={() => createMut.mutate()}
          disabled={!form.title.trim() || !form.slug.trim()}
        >
          Oluştur
        </Button>
      </div>
    </div>
  );
}
