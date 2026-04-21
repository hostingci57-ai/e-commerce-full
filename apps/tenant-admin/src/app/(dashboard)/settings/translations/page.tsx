'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listBundles,
  listTenantLanguages,
  updateBundle,
} from '@/lib/queries';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const NAMESPACES = ['storefront', 'admin', 'email'];

export default function TranslationsPage() {
  const qc = useQueryClient();
  const langsQ = useQuery({ queryKey: ['tenant-langs'], queryFn: listTenantLanguages });
  const [lang, setLang] = useState<string>('tr');
  const [ns, setNs] = useState<string>('storefront');

  useEffect(() => {
    if (langsQ.data && langsQ.data.length > 0 && !langsQ.data.some((l) => l.languageCode === lang)) {
      setLang(langsQ.data[0].languageCode);
    }
  }, [langsQ.data, lang]);

  // Also load the default (TR) bundle as the base template so that empty keys
  // inherit from default translations rather than disappearing entirely.
  const defaultQ = useQuery({
    queryKey: ['bundle', 'tr', ns],
    queryFn: () => listBundles({ languageCode: 'tr', namespace: ns }),
  });
  const currentQ = useQuery({
    queryKey: ['bundle', lang, ns],
    queryFn: () => listBundles({ languageCode: lang, namespace: ns }),
    enabled: !!lang,
  });

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const current = currentQ.data?.[0];
    setDraft(current?.strings ?? {});
  }, [currentQ.data, lang, ns]);

  const keys = useMemo(() => {
    const defaultStrings = defaultQ.data?.[0]?.strings ?? {};
    return Object.keys({ ...defaultStrings, ...draft }).sort();
  }, [defaultQ.data, draft]);

  const saveMut = useMutation({
    mutationFn: () => updateBundle({ languageCode: lang, namespace: ns, strings: draft }),
    onSuccess: () => {
      toast.success('Çeviriler kaydedildi');
      qc.invalidateQueries({ queryKey: ['bundle', lang, ns] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız'),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Çeviriler</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dil ve namespace seçin, tabloda metinleri düzenleyin. Boş kalan anahtarlar varsayılana düşer.
        </p>
      </div>

      <Card>
        <CardHeader title="Seçim" />
        <CardBody className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Dil</span>
            <Select value={lang} onChange={(e) => setLang(e.target.value)}>
              {(langsQ.data ?? []).map((l) => (
                <option key={l.languageCode} value={l.languageCode}>
                  {l.languageCode} {l.isDefault ? '(varsayılan)' : ''}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Namespace</span>
            <Select value={ns} onChange={(e) => setNs(e.target.value)}>
              {NAMESPACES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <div className="ml-auto self-end">
            <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Kaydet
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${lang} / ${ns}`} description={`${keys.length} anahtar`} />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Anahtar
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Varsayılan (TR)
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Çeviri ({lang})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => {
                const defaultVal = (defaultQ.data?.[0]?.strings ?? {})[k] ?? '';
                return (
                  <tr key={k}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-700">{k}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{defaultVal}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={draft[k] ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                    Bu namespace'te çeviri yok.
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
