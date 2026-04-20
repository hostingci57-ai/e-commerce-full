'use client';

import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import type { Address } from '@/lib/types';

interface Props {
  initial?: Partial<Address>;
  onSubmit: (a: Address) => void | Promise<void>;
  submitLabel?: string;
}

export function AddressForm({ initial, onSubmit, submitLabel = 'Devam' }: Props) {
  const [form, setForm] = useState<Address>({
    fullName: initial?.fullName ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postalCode: initial?.postalCode ?? '',
    country: initial?.country ?? 'TR',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Address>(k: K, v: Address[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gonderim hatasi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Ad Soyad"
          required
          value={form.fullName}
          onChange={(e) => set('fullName', e.target.value)}
        />
        <Input
          label="Telefon"
          required
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </div>
      <Input
        label="Adres Satiri 1"
        required
        value={form.line1}
        onChange={(e) => set('line1', e.target.value)}
      />
      <Input
        label="Adres Satiri 2"
        value={form.line2 ?? ''}
        onChange={(e) => set('line2', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Sehir"
          required
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
        />
        <Input
          label="Ilce"
          value={form.state ?? ''}
          onChange={(e) => set('state', e.target.value)}
        />
        <Input
          label="Posta Kodu"
          required
          value={form.postalCode}
          onChange={(e) => set('postalCode', e.target.value)}
        />
      </div>
      <Select
        label="Ulke"
        value={form.country}
        onChange={(e) => set('country', e.target.value)}
      >
        <option value="TR">Turkiye</option>
      </Select>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" loading={loading} size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
