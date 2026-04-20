'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import type { CouponListItem, CouponType } from '@/lib/queries';
import { parseTryToKurus } from '@/lib/format';

/** Form payload — string fields are serialized as kurus (minor units) before POST. */
export interface CouponFormValues {
  code: string;
  type: CouponType;
  /** PERCENT: percent value 1..100 (UI), FIXED: TRY string, FREE_SHIPPING: "0" */
  value: string;
  minimumAmount: string;
  maximumDiscount: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
  stackable: boolean;
  isActive: boolean;
  categoryIdsCsv: string;
  productIdsCsv: string;
  customerGroupIdsCsv: string;
}

const DEFAULTS: CouponFormValues = {
  code: '',
  type: 'PERCENT',
  value: '',
  minimumAmount: '',
  maximumDiscount: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  usageLimitPerCustomer: '',
  stackable: false,
  isActive: true,
  categoryIdsCsv: '',
  productIdsCsv: '',
  customerGroupIdsCsv: '',
};

function toWire(v: CouponFormValues): Partial<CouponListItem> & {
  code: string;
  type: CouponType;
  value: string;
} {
  let wireValue = '0';
  if (v.type === 'PERCENT') {
    const n = Number(v.value.replace(',', '.'));
    const basisPoints = Math.round(Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) * 100);
    wireValue = String(basisPoints);
  } else if (v.type === 'FIXED') {
    wireValue = String(parseTryToKurus(v.value));
  } else {
    wireValue = '0';
  }
  const csvToArray = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  return {
    code: v.code.trim(),
    type: v.type,
    value: wireValue,
    minimumAmount: v.minimumAmount ? String(parseTryToKurus(v.minimumAmount)) : null,
    maximumDiscount: v.maximumDiscount
      ? String(parseTryToKurus(v.maximumDiscount))
      : null,
    startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null,
    endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
    usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
    usageLimitPerCustomer: v.usageLimitPerCustomer
      ? Number(v.usageLimitPerCustomer)
      : null,
    stackable: v.stackable,
    isActive: v.isActive,
    customerGroupIds: csvToArray(v.customerGroupIdsCsv),
    categoryIds: csvToArray(v.categoryIdsCsv),
    productIds: csvToArray(v.productIdsCsv),
  };
}

function fromWire(row: CouponListItem): CouponFormValues {
  const toTry = (v?: string | number | null) => {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? (n / 100).toFixed(2) : '';
  };
  let valueStr = '';
  if (row.type === 'PERCENT') {
    const n = Number(row.value);
    valueStr = Number.isFinite(n) ? (n / 100).toString() : '';
  } else if (row.type === 'FIXED') {
    valueStr = toTry(row.value);
  } else {
    valueStr = '0';
  }
  return {
    code: row.code,
    type: row.type,
    value: valueStr,
    minimumAmount: toTry(row.minimumAmount),
    maximumDiscount: toTry(row.maximumDiscount),
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : '',
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : '',
    usageLimit: row.usageLimit ? String(row.usageLimit) : '',
    usageLimitPerCustomer: row.usageLimitPerCustomer
      ? String(row.usageLimitPerCustomer)
      : '',
    stackable: row.stackable,
    isActive: row.isActive,
    categoryIdsCsv: (row.categoryIds ?? []).join(', '),
    productIdsCsv: (row.productIds ?? []).join(', '),
    customerGroupIdsCsv: (row.customerGroupIds ?? []).join(', '),
  };
}

export interface CouponFormProps {
  open: boolean;
  initial: CouponListItem | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (wire: ReturnType<typeof toWire>) => Promise<void> | void;
}

export function CouponForm({ open, initial, busy, onClose, onSubmit }: CouponFormProps) {
  const [values, setValues] = useState<CouponFormValues>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(initial ? fromWire(initial) : DEFAULTS);
    setError(null);
  }, [open, initial]);

  const isEdit = !!initial;

  const submit = async () => {
    setError(null);
    try {
      await onSubmit(toWire(values));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Kuponu düzenle' : 'Yeni kupon'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={busy}>
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Kod" required>
          <Input
            value={values.code}
            onChange={(e) => setValues({ ...values, code: e.target.value.toUpperCase() })}
            placeholder="ORN: BAHAR10"
          />
        </FormField>
        <FormField label="Tip" required>
          <Select
            value={values.type}
            onChange={(e) => setValues({ ...values, type: e.target.value as CouponType })}
          >
            <option value="PERCENT">Yüzde indirim (%)</option>
            <option value="FIXED">Sabit tutar (TL)</option>
            <option value="FREE_SHIPPING">Ücretsiz kargo</option>
          </Select>
        </FormField>
        {values.type !== 'FREE_SHIPPING' ? (
          <FormField
            label={values.type === 'PERCENT' ? 'Değer (%)' : 'Değer (TL)'}
            required
          >
            <Input
              value={values.value}
              onChange={(e) => setValues({ ...values, value: e.target.value })}
              placeholder={values.type === 'PERCENT' ? '10' : '50.00'}
            />
          </FormField>
        ) : (
          <div />
        )}
        <FormField label="Min. sepet tutarı (TL, opsiyonel)">
          <Input
            value={values.minimumAmount}
            onChange={(e) => setValues({ ...values, minimumAmount: e.target.value })}
            placeholder="0.00"
          />
        </FormField>
        <FormField label="Maks. indirim tutarı (TL, opsiyonel)">
          <Input
            value={values.maximumDiscount}
            onChange={(e) => setValues({ ...values, maximumDiscount: e.target.value })}
            placeholder="200.00"
          />
        </FormField>
        <FormField label="Başlangıç">
          <Input
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => setValues({ ...values, startsAt: e.target.value })}
          />
        </FormField>
        <FormField label="Bitiş">
          <Input
            type="datetime-local"
            value={values.endsAt}
            onChange={(e) => setValues({ ...values, endsAt: e.target.value })}
          />
        </FormField>
        <FormField label="Toplam kullanım limiti">
          <Input
            value={values.usageLimit}
            onChange={(e) => setValues({ ...values, usageLimit: e.target.value })}
            placeholder="Örn. 100"
          />
        </FormField>
        <FormField label="Müşteri başına limit">
          <Input
            value={values.usageLimitPerCustomer}
            onChange={(e) =>
              setValues({ ...values, usageLimitPerCustomer: e.target.value })
            }
            placeholder="Örn. 1"
          />
        </FormField>
        <FormField label="Kategori kapsamı (UUID, virgülle ayrılmış)">
          <Textarea
            rows={2}
            value={values.categoryIdsCsv}
            onChange={(e) => setValues({ ...values, categoryIdsCsv: e.target.value })}
          />
        </FormField>
        <FormField label="Ürün kapsamı (UUID, virgülle ayrılmış)">
          <Textarea
            rows={2}
            value={values.productIdsCsv}
            onChange={(e) => setValues({ ...values, productIdsCsv: e.target.value })}
          />
        </FormField>
        <FormField label="Müşteri grubu kapsamı (UUID)">
          <Textarea
            rows={2}
            value={values.customerGroupIdsCsv}
            onChange={(e) =>
              setValues({ ...values, customerGroupIdsCsv: e.target.value })
            }
          />
        </FormField>
        <div className="flex items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.isActive}
              onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
            />
            Aktif
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.stackable}
              onChange={(e) => setValues({ ...values, stackable: e.target.checked })}
            />
            Diğer kuponlarla birleştirilebilir
          </label>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </Dialog>
  );
}
