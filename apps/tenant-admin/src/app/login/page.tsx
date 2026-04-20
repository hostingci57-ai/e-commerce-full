'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LogIn, Store } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { setTokens, setUser } from '@/lib/auth-store';
import { Button, Card, CardBody, CardHeader, Input, Label } from '@/components/ui';
import { FormField } from '@/components/FormField';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(6, 'En az 6 karakter'),
});
type LoginInput = z.infer<typeof LoginSchema>;

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    tenantId: string | null;
    roles: string[];
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    setSubmitting(true);
    try {
      const res = await api.post<LoginResponse>('/auth/staff/login', values, {
        skipAuth: true,
      });
      setTokens(res.accessToken, res.refreshToken);
      setUser({
        userId: res.user.id,
        email: res.user.email,
        tenantId: res.user.tenantId,
        roles: res.user.roles,
        audience: 'staff',
      });
      toast.success('Giriş başarılı');
      router.replace('/dashboard');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Giriş yapılamadı';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Store className="h-5 w-5 text-brand-600" /> Tenant Admin
            </span>
          }
          description="Mağaza yönetim paneline giriş yapın"
        />
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              label="E-posta"
              htmlFor="email"
              required
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                invalid={!!errors.email}
                {...register('email')}
              />
            </FormField>
            <FormField
              label="Şifre"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                invalid={!!errors.password}
                {...register('password')}
              />
            </FormField>
            <Button
              type="submit"
              className="w-full"
              loading={submitting}
            >
              <LogIn className="h-4 w-4" /> Giriş Yap
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
