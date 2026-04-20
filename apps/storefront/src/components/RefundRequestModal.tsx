'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';

const CATEGORIES = [
  { value: 'DAMAGED', label: 'Urun hasarli' },
  { value: 'WRONG_ITEM', label: 'Yanlis urun' },
  { value: 'SIZE_ISSUE', label: 'Beden / olcu sorunu' },
  { value: 'NOT_AS_DESCRIBED', label: 'Aciklamaya uymuyor' },
  { value: 'CHANGED_MIND', label: 'Vazgectim' },
  { value: 'OTHER', label: 'Diger' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

interface Props {
  orderId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal for customers to create a refund request. Backend accepts a whole-order
 * refund by default (reason + reasonCategory), so this form keeps the surface
 * minimal while leaving room to expand into line-level selections later.
 */
export function RefundRequestModal({ orderId, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<CategoryValue>('OTHER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) {
      setError('Sebep girilmeli');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.orders.refundRequest(orderId, {
        reason: reason.trim(),
        reasonCategory: category,
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Iade talebi olusturulamadi',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Iade Talebi</h2>
        <p className="mt-1 text-sm text-slate-600">
          Talebiniz incelendikten sonra size geri donecegiz.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Kategori
            </span>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryValue)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Sebep
            </span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Iade sebebinizi kisaca aciklayin"
            />
          </label>
          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Vazgec
          </Button>
          <Button loading={submitting} onClick={submit}>
            Gonder
          </Button>
        </div>
      </div>
    </div>
  );
}
