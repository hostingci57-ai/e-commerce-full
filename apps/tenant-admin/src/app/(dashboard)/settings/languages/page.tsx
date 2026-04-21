'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  deleteTenantLanguage,
  listLanguages,
  listTenantLanguages,
  upsertTenantLanguage,
} from '@/lib/queries';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function LanguagesPage() {
  const qc = useQueryClient();

  const allLangs = useQuery({ queryKey: ['all-langs'], queryFn: listLanguages });
  const mine = useQuery({
    queryKey: ['tenant-langs'],
    queryFn: listTenantLanguages,
  });

  const upsertMut = useMutation({
    mutationFn: upsertTenantLanguage,
    onSuccess: () => {
      toast.success('Kaydedildi');
      qc.invalidateQueries({ queryKey: ['tenant-langs'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız'),
  });

  const delMut = useMutation({
    mutationFn: (code: string) => deleteTenantLanguage(code),
    onSuccess: () => {
      toast.success('Silindi');
      qc.invalidateQueries({ queryKey: ['tenant-langs'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Silinemedi'),
  });

  const active = mine.data ?? [];
  const activeCodes = new Set(active.map((a) => a.languageCode));
  const catalog = (allLangs.data ?? []).filter((l) => l.isActive);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Diller</h1>
        <p className="mt-1 text-sm text-slate-500">
          Storefront üzerinde görünecek dilleri seçin ve varsayılanı belirleyin.
        </p>
      </div>

      <Card>
        <CardHeader title="Aktif Diller" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Kod
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Ad
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Varsayılan
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Yayın
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((t) => {
                const meta = catalog.find((c) => c.code === t.languageCode);
                return (
                  <tr key={t.languageCode}>
                    <td className="px-4 py-2 font-mono text-xs">{t.languageCode}</td>
                    <td className="px-4 py-2">
                      {meta ? `${meta.nativeName} (${meta.name})` : t.languageCode}
                    </td>
                    <td className="px-4 py-2">
                      {t.isDefault ? (
                        <Badge tone="indigo">Varsayılan</Badge>
                      ) : (
                        <button
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() =>
                            upsertMut.mutate({
                              languageCode: t.languageCode,
                              isDefault: true,
                              isPublished: t.isPublished,
                            })
                          }
                        >
                          Varsayılan yap
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={t.isPublished}
                        onChange={(e) =>
                          upsertMut.mutate({
                            languageCode: t.languageCode,
                            isDefault: t.isDefault,
                            isPublished: e.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {t.isDefault ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`${t.languageCode} silinsin mi?`))
                              delMut.mutate(t.languageCode);
                          }}
                          className="text-red-600 hover:text-red-700"
                          aria-label="Kaldır"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {active.length === 0 && !mine.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Aktif dil yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ekle" description="Global dil kataloğundan ekleyin" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {catalog.map((c) => (
              <Button
                key={c.code}
                variant={activeCodes.has(c.code) ? 'ghost' : 'outline'}
                size="sm"
                disabled={activeCodes.has(c.code) || upsertMut.isPending}
                onClick={() =>
                  upsertMut.mutate({
                    languageCode: c.code,
                    isDefault: active.length === 0,
                    isPublished: true,
                  })
                }
              >
                {c.nativeName} ({c.code})
              </Button>
            ))}
            {catalog.length === 0 && !allLangs.isLoading ? (
              <span className="text-sm text-slate-500">Henüz global dil yok.</span>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
