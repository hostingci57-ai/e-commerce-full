'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AddressForm } from '@/components/AddressForm';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import type { Address } from '@/lib/types';

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.customer.addresses.list();
      setAddresses(list);
    } catch (e) {
      setError('Adresler yuklenemedi. Once giris yapin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (a: Address) => {
    await api.customer.addresses.create(a);
    setAdding(false);
    await load();
  };

  const remove = async (id?: string) => {
    if (!id) return;
    await api.customer.addresses.remove(id);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <p className="text-sm text-slate-500">Henuz kayitli adresiniz yok.</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="text-sm">
                <p className="font-semibold text-slate-900">{a.fullName}</p>
                <p className="text-slate-600">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                </p>
                <p className="text-slate-600">
                  {a.city} {a.state ? `/ ${a.state}` : ''} {a.postalCode}
                </p>
                <p className="text-slate-600">Tel: {a.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Yeni Adres</h3>
          <AddressForm onSubmit={create} submitLabel="Kaydet" />
        </div>
      ) : (
        <Button onClick={() => setAdding(true)}>Yeni Adres Ekle</Button>
      )}
    </div>
  );
}
