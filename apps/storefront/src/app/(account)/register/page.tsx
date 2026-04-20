'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.auth.register({ firstName, lastName, email, password });
      router.push('/account/profile');
    } catch (err) {
      setError(err instanceof Error ? 'Kayit olusturulamadi' : 'Kayit basarisiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex justify-center py-16">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">Uye Ol</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ad"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Soyad"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" loading={loading} size="lg" className="w-full">
          Uye Ol
        </Button>
        <p className="text-center text-sm text-slate-600">
          Zaten hesabin var mi?{' '}
          <Link href="/login" className="text-brand-700 hover:underline">
            Giris yap
          </Link>
        </p>
      </form>
    </div>
  );
}
