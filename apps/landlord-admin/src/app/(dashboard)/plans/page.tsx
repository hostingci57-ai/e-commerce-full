'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

interface Plan {
  id: string;
  code: string;
  name: string;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function PlansPage(): JSX.Element {
  const plans = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api<Plan[]>('/v1/landlord/plans'),
  });

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Paketler</h1>
        <p className="text-sm text-gray-500">Sadece okuma. Seed üzerinden yönetilir.</p>
      </header>

      {plans.isLoading ? <p className="text-gray-500">Yükleniyor...</p> : null}
      {plans.isError ? <p className="text-red-600">Paketler yüklenemedi.</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.data?.map((plan) => {
          const price = readNumber(plan.features.pricePerMonth);
          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge tone="muted">{plan.code}</Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <p className="text-2xl font-semibold text-gray-900">
                  {price === null ? 'Talep üzerine' : new Intl.NumberFormat('tr-TR').format(price) + ' ₺/ay'}
                </p>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Limitler</p>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Metrik</TH>
                        <TH>Değer</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {Object.entries(plan.limits).map(([k, v]) => (
                        <TR key={k}>
                          <TD className="text-gray-600">{k}</TD>
                          <TD>{v === null || v === undefined ? 'Sınırsız' : String(v)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function readNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}
