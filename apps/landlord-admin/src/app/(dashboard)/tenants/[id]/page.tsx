'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, ShoppingCart, Package, UsersRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge, tenantStatusTone } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Plan {
  id: string;
  code: string;
  name: string;
}

type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled' | 'deleted';

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  planId: string;
  createdAt: string;
  updatedAt: string;
  plan: Plan | null;
  stats: {
    orderCount: number;
    customerCount: number;
    activeProductCount: number;
    memberCount: number;
  };
}

export default function TenantDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [planDialog, setPlanDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tenant = useQuery<TenantDetail>({
    queryKey: ['tenant', id],
    queryFn: () => api<TenantDetail>(`/v1/landlord/tenants/${id}`),
  });

  const plans = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api<Plan[]>('/v1/landlord/plans'),
  });

  function onActionDone(): void {
    setActionError(null);
    qc.invalidateQueries({ queryKey: ['tenant', id] });
    qc.invalidateQueries({ queryKey: ['tenants'] });
  }

  const suspendMut = useMutation({
    mutationFn: () => api(`/v1/landlord/tenants/${id}/suspend`, { method: 'POST' }),
    onSuccess: onActionDone,
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Başarısız'),
  });
  const activateMut = useMutation({
    mutationFn: () => api(`/v1/landlord/tenants/${id}/activate`, { method: 'POST' }),
    onSuccess: onActionDone,
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Başarısız'),
  });
  const deleteMut = useMutation({
    mutationFn: () => api(`/v1/landlord/tenants/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteDialog(false);
      onActionDone();
      router.replace('/tenants');
    },
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Başarısız'),
  });
  const planMut = useMutation({
    mutationFn: (planId: string) =>
      api(`/v1/landlord/tenants/${id}/plan`, { method: 'PATCH', body: { planId } }),
    onSuccess: () => {
      setPlanDialog(false);
      onActionDone();
    },
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Başarısız'),
  });

  if (tenant.isLoading) {
    return <div className="p-6 text-gray-500">Yükleniyor...</div>;
  }
  if (tenant.isError || !tenant.data) {
    return <div className="p-6 text-red-600">Tenant bulunamadı.</div>;
  }
  const t = tenant.data;

  return (
    <div className="p-6">
      <Link
        href="/tenants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Tenantlar
      </Link>

      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{t.name}</h1>
            <Badge tone={tenantStatusTone(t.status)}>{t.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {t.subdomain}.localhost · Oluşturuldu {formatDate(t.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status !== 'deleted' ? (
            <>
              <Button variant="secondary" onClick={() => setPlanDialog(true)}>
                Paket Değiştir
              </Button>
              {t.status === 'suspended' ? (
                <Button onClick={() => activateMut.mutate()} loading={activateMut.isPending}>
                  Aktifleştir
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => suspendMut.mutate()}
                  loading={suspendMut.isPending}
                >
                  Askıya Al
                </Button>
              )}
              <Button variant="destructive" onClick={() => setDeleteDialog(true)}>
                Sil
              </Button>
            </>
          ) : (
            <Button onClick={() => activateMut.mutate()} loading={activateMut.isPending}>
              Geri Yükle
            </Button>
          )}
        </div>
      </header>

      {actionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Siparişler" value={t.stats.orderCount} icon={ShoppingCart} />
        <StatCard label="Müşteriler" value={t.stats.customerCount} icon={Users} />
        <StatCard label="Aktif Ürün" value={t.stats.activeProductCount} icon={Package} />
        <StatCard label="Personel" value={t.stats.memberCount} icon={UsersRound} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paket</CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2">
              <dt className="text-gray-500">Ad</dt>
              <dd>{t.plan?.name ?? '—'}</dd>
              <dt className="text-gray-500">Kod</dt>
              <dd className="font-mono text-xs">{t.plan?.code ?? '—'}</dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Meta</CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2">
              <dt className="text-gray-500">ID</dt>
              <dd className="font-mono text-xs">{t.id}</dd>
              <dt className="text-gray-500">Güncellendi</dt>
              <dd>{formatDate(t.updatedAt)}</dd>
            </dl>
          </CardBody>
        </Card>
      </div>

      <Dialog open={planDialog} onClose={() => setPlanDialog(false)} title="Paket Değiştir">
        <PlanChanger
          plans={plans.data ?? []}
          currentPlanId={t.planId}
          loading={planMut.isPending}
          onCancel={() => setPlanDialog(false)}
          onSubmit={(planId) => planMut.mutate(planId)}
        />
      </Dialog>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} title="Tenantı Sil">
        <p className="text-sm text-gray-700">
          <strong>{t.name}</strong> silinsin mi? Bu işlem soft-delete olarak işaretlenir.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteDialog(false)}>
            Vazgeç
          </Button>
          <Button variant="destructive" onClick={() => deleteMut.mutate()} loading={deleteMut.isPending}>
            Sil
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function PlanChanger({
  plans,
  currentPlanId,
  loading,
  onSubmit,
  onCancel,
}: {
  plans: Plan[];
  currentPlanId: string;
  loading: boolean;
  onSubmit: (planId: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const [selected, setSelected] = useState(currentPlanId);
  return (
    <div className="space-y-4">
      <Select label="Paket" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button
          disabled={!selected || selected === currentPlanId}
          loading={loading}
          onClick={() => onSubmit(selected)}
        >
          Kaydet
        </Button>
      </div>
    </div>
  );
}
