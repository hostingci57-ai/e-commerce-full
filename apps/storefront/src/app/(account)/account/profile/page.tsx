'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';

interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.customer.me();
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setError('Profili yuklemek icin giris yapin.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    setInfo(null);
    try {
      await api.customer.updateMe({
        firstName: me.firstName,
        lastName: me.lastName,
        phone: me.phone,
      });
      setInfo('Profil guncellendi.');
    } catch {
      setError('Guncelleme basarisiz.');
    } finally {
      setSaving(false);
    }
  };

  const giveConsent = async () => {
    try {
      await api.customer.kvkk.consent(true);
      setConsent(true);
      setInfo('KVKK aydinlatma metni onaylandi.');
    } catch {
      setError('KVKK onayi kaydedilemedi.');
    }
  };

  const requestExport = async () => {
    try {
      await api.customer.kvkk.requestExport();
      setInfo('Veri ihrac talebiniz alindi. Emailinize gonderilecek.');
    } catch {
      setError('Talep gonderilemedi.');
    }
  };

  const requestDelete = async () => {
    if (!confirm('Hesabinizin silinmesini istediginizden emin misiniz?')) return;
    try {
      await api.customer.kvkk.requestDelete();
      setInfo('Silme talebiniz alindi. Belirtilen surede islenecektir.');
    } catch {
      setError('Talep gonderilemedi.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {error ?? 'Profil bulunamadi.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={save}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <h2 className="text-lg font-semibold">Profil</h2>
        <Input label="Email" type="email" value={me.email} disabled readOnly />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ad"
            value={me.firstName}
            onChange={(e) => setMe({ ...me, firstName: e.target.value })}
          />
          <Input
            label="Soyad"
            value={me.lastName}
            onChange={(e) => setMe({ ...me, lastName: e.target.value })}
          />
        </div>
        <Input
          label="Telefon"
          value={me.phone ?? ''}
          onChange={(e) => setMe({ ...me, phone: e.target.value })}
        />
        {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" loading={saving}>
          Kaydet
        </Button>
      </form>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">KVKK Kontrol Paneli</h2>
        <p className="text-sm text-slate-600">
          Kisisel verilerinizin islenmesine iliskin haklarinizi buradan
          yonetebilirsiniz.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={giveConsent} disabled={consent}>
            Aydinlatma Metnini Onayla
          </Button>
          <Button variant="secondary" onClick={requestExport}>
            Verilerimi Indir
          </Button>
          <Button variant="danger" onClick={requestDelete}>
            Hesabimi Sil
          </Button>
        </div>
      </section>
    </div>
  );
}
