'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

interface Plan {
  id: string;
  code: string;
  name: string;
}

const Schema = z.object({
  name: z.string().trim().min(2, 'En az 2 karakter').max(120),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,30}$/, '3-30 karakter, yalnız a-z 0-9 ve tire'),
  ownerEmail: z.string().email('Geçerli bir e-posta girin'),
  ownerPassword: z.string().min(8, 'En az 8 karakter'),
  planId: z.string().uuid('Paket seçin'),
});
type FormValues = z.infer<typeof Schema>;

export default function NewTenantPage(): JSX.Element {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const plans = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api<Plan[]>('/v1/landlord/plans'),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: '', subdomain: '', ownerEmail: '', ownerPassword: '', planId: '' },
  });

  useEffect(() => {
    if (plans.data && plans.data.length > 0) {
      setValue('planId', plans.data[0]!.id);
    }
  }, [plans.data, setValue]);

  async function onSubmit(values: FormValues): Promise<void> {
    setApiError(null);
    try {
      const res = await api<{ id: string }>('/v1/landlord/tenants', {
        method: 'POST',
        body: values,
      });
      router.replace(`/tenants/${res.id}`);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Oluşturulamadı');
    }
  }

  return (
    <div className="p-6">
      <Link
        href="/tenants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Tenantlar
      </Link>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Yeni Tenant</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input label="Tenant adı" {...register('name')} error={errors.name?.message} />
            <Input
              label="Subdomain"
              placeholder="acme"
              {...register('subdomain')}
              error={errors.subdomain?.message}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Yetkili e-posta"
                type="email"
                autoComplete="off"
                {...register('ownerEmail')}
                error={errors.ownerEmail?.message}
              />
              <Input
                label="Yetkili parola"
                type="password"
                autoComplete="new-password"
                {...register('ownerPassword')}
                error={errors.ownerPassword?.message}
              />
            </div>
            <Select label="Paket" {...register('planId')} error={errors.planId?.message}>
              <option value="" disabled>
                {plans.isLoading ? 'Yükleniyor...' : 'Paket seçin'}
              </option>
              {plans.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            {apiError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {apiError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Link href="/tenants">
                <Button type="button" variant="secondary">
                  İptal
                </Button>
              </Link>
              <Button type="submit" loading={isSubmitting}>
                Oluştur
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
