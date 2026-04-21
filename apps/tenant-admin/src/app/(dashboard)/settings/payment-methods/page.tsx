'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Power } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Input,
  Select,
  Textarea,
  Checkbox,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import {
  deletePaymentMethodConfig,
  listPaymentMethodConfigs,
  listPaymentProviders,
  upsertPaymentMethodConfig,
  updatePaymentMethodConfig,
  type PaymentMethodConfig,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function PaymentMethodsPage() {
  const qc = useQueryClient();
  const providersQ = useQuery({ queryKey: ['payment-providers'], queryFn: listPaymentProviders });
  const configsQ = useQuery({
    queryKey: ['payment-methods'],
    queryFn: listPaymentMethodConfigs,
  });

  const [editOpen, setEditOpen] = useState<PaymentMethodConfig | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const configsByCode = useMemo(() => {
    const map = new Map<string, PaymentMethodConfig>();
    for (const c of configsQ.data ?? []) map.set(c.providerCode, c);
    return map;
  }, [configsQ.data]);

  const providers = providersQ.data ?? [];

  const toggleMut = useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      updatePaymentMethodConfig(args.id, { isActive: args.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Güncellendi');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Güncellenemedi'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePaymentMethodConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Silindi');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Silinemedi'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ödeme Yöntemleri</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ödeme sağlayıcılarını etkinleştirin, mesaj ve konfigürasyonu düzenleyin.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Yeni Yöntem
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
                  Gösterim Adı
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Durum
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sıra
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configsQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Yükleniyor…
                  </td>
                </tr>
              ) : (configsQ.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Henüz yöntem tanımlanmamış.
                  </td>
                </tr>
              ) : (
                (configsQ.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {c.providerCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.displayName}</div>
                      {c.description ? (
                        <div className="text-xs text-slate-500">{c.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {c.isActive ? (
                        <Badge tone="green">Aktif</Badge>
                      ) : (
                        <Badge tone="slate">Pasif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.sortOrder}</td>
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
                            if (confirm(`${c.displayName} silinsin mi?`)) deleteMut.mutate(c.id);
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

      <Card>
        <CardHeader title="Platform Sağlayıcıları" />
        <CardBody>
          <p className="mb-3 text-sm text-slate-500">
            Aşağıdaki sağlayıcılar platformda yerleşik olarak bulunuyor. Tıklayarak mağaza için
            etkinleştirebilirsiniz.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => {
              const configured = configsByCode.has(p.code);
              return (
                <div
                  key={p.code}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-slate-900">{p.displayName}</div>
                    <div className="font-mono text-xs text-slate-500">{p.code}</div>
                  </div>
                  {configured ? (
                    <Badge tone="green">Tanımlı</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditOpen({
                          id: '',
                          providerCode: p.code,
                          displayName: p.displayName,
                          description: null,
                          config: {},
                          isActive: true,
                          sortOrder: 0,
                          minAmount: null,
                          maxAmount: null,
                        })
                      }
                    >
                      Ekle
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {addOpen ? (
        <PaymentMethodDialog
          providers={providers}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ['payment-methods'] });
          }}
        />
      ) : null}

      {editOpen ? (
        <PaymentMethodDialog
          providers={providers}
          existing={editOpen}
          onClose={() => setEditOpen(null)}
          onSaved={() => {
            setEditOpen(null);
            qc.invalidateQueries({ queryKey: ['payment-methods'] });
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentMethodDialog({
  providers,
  existing,
  onClose,
  onSaved,
}: {
  providers: { code: string; displayName: string }[];
  existing?: PaymentMethodConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [providerCode, setProviderCode] = useState(existing?.providerCode ?? providers[0]?.code ?? 'cod');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder ?? 0);
  const [configJson, setConfigJson] = useState(
    existing ? JSON.stringify(existing.config ?? {}, null, 2) : '{}',
  );
  const [minAmount, setMinAmount] = useState(existing?.minAmount ?? '');
  const [maxAmount, setMaxAmount] = useState(existing?.maxAmount ?? '');

  const saveMut = useMutation({
    mutationFn: async () => {
      let configObj: Record<string, unknown> = {};
      try {
        configObj = configJson ? JSON.parse(configJson) : {};
      } catch {
        throw new Error('Config geçerli JSON değil');
      }
      return upsertPaymentMethodConfig({
        providerCode,
        displayName,
        description: description || null,
        config: configObj,
        isActive,
        sortOrder,
        minAmount: minAmount ? String(minAmount) : null,
        maxAmount: maxAmount ? String(maxAmount) : null,
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
      title={existing?.id ? 'Yöntemi Düzenle' : 'Yeni Ödeme Yöntemi'}
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
        <FormField label="Sağlayıcı" required>
          <Select
            value={providerCode}
            onChange={(e) => setProviderCode(e.target.value)}
            disabled={!!existing?.id}
          >
            {providers.map((p) => (
              <option key={p.code} value={p.code}>
                {p.displayName} ({p.code})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Gösterim Adı" required>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormField>
        <FormField label="Açıklama">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Sıra">
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </FormField>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Aktif
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Min Tutar (kuruş)">
            <Input
              value={minAmount ?? ''}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </FormField>
          <FormField label="Max Tutar (kuruş)">
            <Input
              value={maxAmount ?? ''}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </FormField>
        </div>
        <FormField
          label="Konfigürasyon (JSON)"
          hint="Örn. bank_transfer için: {&quot;iban&quot;:&quot;...&quot;,&quot;bank&quot;:&quot;...&quot;}"
        >
          <Textarea rows={5} value={configJson} onChange={(e) => setConfigJson(e.target.value)} />
        </FormField>
      </div>
    </Dialog>
  );
}
