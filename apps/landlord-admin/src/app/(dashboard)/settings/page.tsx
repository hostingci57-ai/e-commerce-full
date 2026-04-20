'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Me {
  id: string;
  email: string;
  firstName: string | null;
  createdAt: string;
  audience: 'landlord' | 'customer' | 'staff';
}

export default function SettingsPage(): JSX.Element {
  const me = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => api<Me>('/v1/auth/me'),
  });

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Ayarlar</h1>
      </header>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardBody className="text-sm">
          {me.isLoading ? (
            <p className="text-gray-500">Yükleniyor...</p>
          ) : me.isError || !me.data ? (
            <p className="text-red-600">Yüklenemedi.</p>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-y-2">
              <dt className="text-gray-500">Kullanıcı</dt>
              <dd>{me.data.firstName ?? '—'}</dd>
              <dt className="text-gray-500">E-posta</dt>
              <dd>{me.data.email}</dd>
              <dt className="text-gray-500">Erişim</dt>
              <dd className="capitalize">{me.data.audience}</dd>
              <dt className="text-gray-500">Oluşturuldu</dt>
              <dd>{formatDate(me.data.createdAt)}</dd>
              <dt className="text-gray-500">ID</dt>
              <dd className="font-mono text-xs">{me.data.id}</dd>
            </dl>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
