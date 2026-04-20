'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Input, Badge, Button } from '@/components/ui';
import { FormField } from '@/components/FormField';
import { getUser } from '@/lib/auth-store';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setEmail(u.email);
      setTenantId(u.tenantId);
      setRoles(u.roles);
    }
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ayarlar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mağaza bilgileri, personel ve abonelik.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mağaza Bilgileri" description="Yakında düzenlenebilir olacak" />
          <CardBody className="space-y-4">
            <FormField label="Tenant ID" hint="Bu değer değiştirilemez">
              <Input value={tenantId ?? ''} readOnly />
            </FormField>
            <FormField label="Subdomain" hint="Planladığınız alt alan adı">
              <Input defaultValue="demo" disabled />
            </FormField>
            <FormField label="Özel Alan Adı (opsiyonel)">
              <Input placeholder="www.magazaniz.com" disabled />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Paket" description="Abonelik ve limit bilgileri" />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Mevcut plan</span>
              <Badge tone="indigo">Starter</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Ürün limiti</span>
              <span className="text-sm font-medium text-slate-800">1.000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Aylık sipariş limiti</span>
              <span className="text-sm font-medium text-slate-800">2.500</span>
            </div>
            <div className="text-xs text-slate-500">
              Abonelik yönetimi mevcut sürümde salt okunur.
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Personel"
            description="Mağaza personeli ve rolleri"
            action={
              <Button variant="outline" disabled>
                Davet Et
              </Button>
            }
          />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Kullanıcı
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rol
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{email ?? '—'}</div>
                    <div className="text-xs text-slate-500">(siz)</div>
                  </td>
                  <td className="px-4 py-3">
                    {roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <Badge key={r} tone="blue">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge tone="blue">Staff</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" disabled>
                      Düzenle
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              Personel davet etme özelliği yakında eklenecek.
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
