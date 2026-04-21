'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader, Input, Button, Select, Textarea } from '@/components/ui';
import { FormField } from '@/components/FormField';
import { getTenantSettings, updateTenantSettings, type TenantSettings } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];
const LANGUAGES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'];
const DIM_UNITS = ['cm', 'mm', 'in'];

export default function GeneralSettingsPage() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ['tenant-settings'], queryFn: getTenantSettings });

  const [form, setForm] = useState<Partial<TenantSettings>>({});

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const saveMut = useMutation({
    mutationFn: (patch: Partial<TenantSettings>) => updateTenantSettings(patch),
    onSuccess: () => {
      toast.success('Ayarlar güncellendi');
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Kaydedilemedi'),
  });

  if (settingsQ.isLoading) return <div className="text-slate-500">Yükleniyor…</div>;

  const patch = (k: keyof TenantSettings, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mağaza Ayarları</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mağaza bilgileri, dil, para birimi, KVKK ve markalaşma.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate(form);
        }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <Card>
          <CardHeader title="Mağaza Kimliği" />
          <CardBody className="space-y-4">
            <FormField label="Mağaza Adı" required>
              <Input
                value={form.storeName ?? ''}
                onChange={(e) => patch('storeName', e.target.value)}
              />
            </FormField>
            <FormField label="Mağaza E-postası" required>
              <Input
                type="email"
                value={form.storeEmail ?? ''}
                onChange={(e) => patch('storeEmail', e.target.value)}
              />
            </FormField>
            <FormField label="Telefon">
              <Input
                value={form.storePhone ?? ''}
                onChange={(e) => patch('storePhone', e.target.value)}
              />
            </FormField>
            <FormField label="Yasal Ünvan">
              <Input
                value={form.legalName ?? ''}
                onChange={(e) => patch('legalName', e.target.value)}
              />
            </FormField>
            <FormField label="Vergi Numarası">
              <Input
                value={form.taxNumber ?? ''}
                onChange={(e) => patch('taxNumber', e.target.value)}
              />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Bölgesel Ayarlar" />
          <CardBody className="space-y-4">
            <FormField label="Para Birimi">
              <Select
                value={form.currency ?? 'TRY'}
                onChange={(e) => patch('currency', e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Varsayılan Dil">
              <Select
                value={form.defaultLanguage ?? 'tr'}
                onChange={(e) => patch('defaultLanguage', e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Zaman Dilimi">
              <Input
                value={form.timezone ?? 'Europe/Istanbul'}
                onChange={(e) => patch('timezone', e.target.value)}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ağırlık Birimi">
                <Select
                  value={form.weightUnit ?? 'kg'}
                  onChange={(e) => patch('weightUnit', e.target.value)}
                >
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Boyut Birimi">
                <Select
                  value={form.dimensionUnit ?? 'cm'}
                  onChange={(e) => patch('dimensionUnit', e.target.value)}
                >
                  {DIM_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="KVKK ve Hukuki" />
          <CardBody className="space-y-4">
            <FormField
              label="KVKK Başvuru E-postası"
              hint="Kişisel verilerle ilgili başvuruların yönlendirileceği adres"
            >
              <Input
                type="email"
                value={form.kvkkContact ?? ''}
                onChange={(e) => patch('kvkkContact', e.target.value)}
              />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Markalaşma" />
          <CardBody className="space-y-4">
            <FormField label="Logo Media ID" hint="Media picker yakında — UUID ile manuel giriş.">
              <Input
                value={form.logoMediaId ?? ''}
                onChange={(e) => patch('logoMediaId', e.target.value || null)}
                placeholder="uuid"
              />
            </FormField>
            <FormField label="Favicon Media ID">
              <Input
                value={form.faviconMediaId ?? ''}
                onChange={(e) => patch('faviconMediaId', e.target.value || null)}
                placeholder="uuid"
              />
            </FormField>
            <FormField label="Marka Rengi (hex)">
              <div className="flex items-center gap-2">
                <Input
                  value={form.primaryColor ?? '#0ea5e9'}
                  onChange={(e) => patch('primaryColor', e.target.value)}
                  placeholder="#0ea5e9"
                />
                <span
                  className="inline-block h-8 w-8 rounded border border-slate-200"
                  style={{ background: form.primaryColor ?? '#0ea5e9' }}
                />
              </div>
            </FormField>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Mağaza Adresi" />
          <CardBody className="space-y-3">
            <Textarea
              rows={4}
              placeholder='JSON: {"line1":"...", "city":"...", "country":"TR"}'
              value={
                form.storeAddress
                  ? JSON.stringify(form.storeAddress, null, 2)
                  : ''
              }
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                  patch('storeAddress', parsed);
                } catch {
                  /* ignore partial typing */
                }
              }}
            />
          </CardBody>
        </Card>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" loading={saveMut.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}
