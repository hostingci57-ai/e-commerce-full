'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Power, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import {
  deleteShippingMethodConfig,
  listShippingMethodConfigs,
  listShippingProviders,
  updateShippingMethodConfig,
  upsertShippingMethodConfig,
  type ShippingMethodConfig,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function ShippingSettingsPage() {
  const qc = useQueryClient();
  const providersQ = useQuery({ queryKey: ['shipping-providers'], queryFn: listShippingProviders });
  const configsQ = useQuery({
    queryKey: ['shipping-methods'],
    queryFn: listShippingMethodConfigs,
  });

  const [editOpen, setEditOpen] = useState<ShippingMethodConfig | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const toggleMut = useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      updateShippingMethodConfig(args.id, { isActive: args.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipping-methods'] });
      toast.success('Güncellendi');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Güncellenemedi'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteShippingMethodConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipping-methods'] });
      toast.success('Silindi');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Silinemedi'),
  });

  const providers = providersQ.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kargo Ayarları</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kargo sağlayıcılarını, ücretlendirme ve eşiklerini tanımlayın.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Yeni Kargo Yöntemi
        </Button>
      </div>

      <Card>
        <CardHeader title="Tanımlı Yöntemler" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sağlayıcı
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kod
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ad
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tahmini Süre
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Durum
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configsQ.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Yükleniyor…
                  </td>
                </tr>
              ) : (configsQ.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Henüz yöntem tanımlanmamış.
                  </td>
                </tr>
              ) : (
                (configsQ.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {c.providerCode}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.displayName}</div>
                      {c.description ? (
                        <div className="text-xs text-slate-500">{c.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.estimatedDaysMin !== null && c.estimatedDaysMax !== null
                        ? `${c.estimatedDaysMin}-${c.estimatedDaysMax} gün`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.isActive ? (
                        <Badge tone="green">Aktif</Badge>
                      ) : (
                        <Badge tone="slate">Pasif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleMut.mutate({ id: c.id, isActive: !c.isActive })
                          }
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditOpen(c)}>
                          Düzenle
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (confirm(`${c.displayName} silinsin mi?`))
                              deleteMut.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {addOpen ? (
        <ShippingMethodDialog
          providers={providers}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ['shipping-methods'] });
          }}
        />
      ) : null}

      {editOpen ? (
        <ShippingMethodDialog
          providers={providers}
          existing={editOpen}
          onClose={() => setEditOpen(null)}
          onSaved={() => {
            setEditOpen(null);
            qc.invalidateQueries({ queryKey: ['shipping-methods'] });
          }}
        />
      ) : null}
    </div>
  );
}

function ShippingMethodDialog({
  providers,
  existing,
  onClose,
  onSaved,
}: {
  providers: { code: string; displayName: string }[];
  existing?: ShippingMethodConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [providerCode, setProviderCode] = useState(
    existing?.providerCode ?? providers[0]?.code ?? 'flat_rate',
  );
  const [code, setCode] = useState(existing?.code ?? 'standard');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder ?? 0);
  const [estMin, setEstMin] = useState<number | ''>(existing?.estimatedDaysMin ?? '');
  const [estMax, setEstMax] = useState<number | ''>(existing?.estimatedDaysMax ?? '');
  const [threshold, setThreshold] = useState(existing?.freeShippingThreshold ?? '');
  const [configJson, setConfigJson] = useState(
    existing ? JSON.stringify(existing.config ?? {}, null, 2) : '{}',
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      let configObj: Record<string, unknown> = {};
      try {
        configObj = configJson ? JSON.parse(configJson) : {};
      } catch {
        throw new Error('Config geçerli JSON değil');
      }
      return upsertShippingMethodConfig({
        providerCode,
        code,
        displayName,
        description: description || null,
        config: configObj,
        isActive,
        sortOrder,
        estimatedDaysMin: estMin === '' ? null : Number(estMin),
        estimatedDaysMax: estMax === '' ? null : Number(estMax),
        freeShippingThreshold: threshold ? String(threshold) : null,
      });
    },
    onSuccess: () => {
      toast.success('Kaydedildi');
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kaydedilemedi'),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing?.id ? 'Kargo Yöntemini Düzenle' : 'Yeni Kargo Yöntemi'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Sağlayıcı" required>
            <Select
              value={providerCode}
              onChange={(e) => setProviderCode(e.target.value)}
              disabled={!!existing?.id}
            >
              {providers.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Kod (eşsiz)" required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!existing?.id}
              placeholder="standard | express | free_500"
            />
          </FormField>
        </div>
        <FormField label="Gösterim Adı" required>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormField>
        <FormField label="Açıklama">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Tahmini min gün">
            <Input
              type="number"
              value={estMin}
              onChange={(e) => setEstMin(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </FormField>
          <FormField label="Tahmini max gün">
            <Input
              type="number"
              value={estMax}
              onChange={(e) => setEstMax(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </FormField>
          <FormField label="Sıra">
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </FormField>
        </div>
        <FormField label="Ücretsiz kargo eşiği (kuruş)" hint="Sadece free_shipping sağlayıcısı için">
          <Input value={threshold ?? ''} onChange={(e) => setThreshold(e.target.value)} />
        </FormField>
        <FormField
          label="Konfigürasyon (JSON)"
          hint='flat_rate için: {"priceMinor":"5000"}'
        >
          <Textarea rows={4} value={configJson} onChange={(e) => setConfigJson(e.target.value)} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Aktif
        </label>
      </div>
    </Dialog>
  );
}
