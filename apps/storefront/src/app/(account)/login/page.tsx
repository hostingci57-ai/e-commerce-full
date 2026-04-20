'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.auth.login(email, password);
      router.push('/account/orders');
    } catch (err) {
      setError(err instanceof Error ? 'Email veya sifre hatali' : 'Giris basarisiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex justify-center py-16">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">Giris Yap</h1>
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Sifre"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" loading={loading} size="lg" className="w-full">
          Giris Yap
        </Button>
        <p className="text-center text-sm text-slate-600">
          Hesabin yok mu?{' '}
          <Link href="/register" className="text-brand-700 hover:underline">
            Uye ol
          </Link>
        </p>
      </form>
    </div>
  );
}
