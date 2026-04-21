'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSeoSettings,
  updateSeoSettings,
  type SeoSettings,
} from '@/lib/queries';
import { Button, Card, CardBody, CardHeader, Input, Textarea } from '@/components/ui';
import { FormField } from '@/components/FormField';

export const dynamic = 'force-dynamic';

const DEFAULT: SeoSettings = {
  defaultTitle: '',
  titleTemplate: '%s | %shopName',
  defaultDescription: '',
  defaultOgImage: '',
  robotsTxt: '',
  googleSiteVerification: '',
  bingSiteVerification: '',
};

export default function SeoSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['seo-settings'],
    queryFn: () => getSeoSettings(),
  });

  const [form, setForm] = useState<SeoSettings>(DEFAULT);

  useEffect(() => {
    if (q.data) {
      setForm({
        defaultTitle: q.data.defaultTitle ?? '',
        titleTemplate: q.data.titleTemplate ?? '%s | %shopName',
        defaultDescription: q.data.defaultDescription ?? '',
        defaultOgImage: q.data.defaultOgImage ?? '',
        robotsTxt: q.data.robotsTxt ?? '',
        googleSiteVerification: q.data.googleSiteVerification ?? '',
        bingSiteVerification: q.data.bingSiteVerification ?? '',
      });
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateSeoSettings({
        defaultTitle: form.defaultTitle || null,
        titleTemplate: form.titleTemplate || null,
        defaultDescription: form.defaultDescription || null,
        defaultOgImage: form.defaultOgImage || null,
        robotsTxt: form.robotsTxt || null,
        googleSiteVerification: form.googleSiteVerification || null,
        bingSiteVerification: form.bingSiteVerification || null,
      }),
    onSuccess: () => {
      toast.success('SEO ayarları kaydedildi');
      qc.invalidateQueries({ queryKey: ['seo-settings'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız'),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">SEO Ayarları</h1>
        <p className="mt-1 text-sm text-slate-500">
          Varsayılan başlık/açıklama, OG görseli, robots.txt ve doğrulama kodları.
        </p>
      </div>

      <Card>
        <CardHeader title="Varsayılan Meta" />
        <CardBody className="space-y-4">
          <FormField label="Varsayılan Başlık">
            <Input
              value={form.defaultTitle ?? ''}
              onChange={(e) => setForm({ ...form, defaultTitle: e.target.value })}
              placeholder="ECF Shop"
            />
          </FormField>
          <FormField
            label="Başlık Şablonu"
            hint="%s = sayfa başlığı, %shopName = mağaza adı"
          >
            <Input
              value={form.titleTemplate ?? ''}
              onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
            />
          </FormField>
          <FormField label="Varsayılan Açıklama">
            <Textarea
              rows={3}
              value={form.defaultDescription ?? ''}
              onChange={(e) =>
                setForm({ ...form, defaultDescription: e.target.value })
              }
            />
          </FormField>
          <FormField label="Varsayılan OG Görsel URL">
            <Input
              value={form.defaultOgImage ?? ''}
              onChange={(e) => setForm({ ...form, defaultOgImage: e.target.value })}
              placeholder="https://cdn.example.com/og.png"
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Site Doğrulama" />
        <CardBody className="space-y-4">
          <FormField label="Google Site Verification">
            <Input
              value={form.googleSiteVerification ?? ''}
              onChange={(e) =>
                setForm({ ...form, googleSiteVerification: e.target.value })
              }
              placeholder="google-site-verification=..."
            />
          </FormField>
          <FormField label="Bing Site Verification">
            <Input
              value={form.bingSiteVerification ?? ''}
              onChange={(e) =>
                setForm({ ...form, bingSiteVerification: e.target.value })
              }
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="robots.txt"
          description="Boş bırakılırsa varsayılan içerik kullanılır."
        />
        <CardBody>
          <Textarea
            rows={8}
            value={form.robotsTxt ?? ''}
            onChange={(e) => setForm({ ...form, robotsTxt: e.target.value })}
            placeholder={'User-agent: *\nAllow: /\nDisallow: /checkout\n\nSitemap: https://example.com/sitemap.xml'}
          />
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}
