'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { setToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(8, 'En az 8 karakter'),
});
type FormValues = z.infer<typeof Schema>;

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setApiError(null);
    try {
      const res = await api<LoginResponse>('/v1/auth/landlord/login', {
        method: 'POST',
        body: values,
        auth: false,
      });
      setToken(res.accessToken, values.email);
      router.replace('/tenants');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Giriş başarısız';
      setApiError(msg);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <CardTitle>Landlord Giriş</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="E-posta"
              type="email"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Parola"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />
            {apiError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {apiError}
              </div>
            ) : null}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Giriş Yap
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
